/**
 * Maqola matni (cheklangan Markdown) -> bloklar.
 *
 * Natija React elementlariga aylantiriladi (ArticleContent.tsx) — HTML sifatida
 * hech qachon ishlanmaydi (`dangerouslySetInnerHTML` yo'q). Shuning uchun matnga
 * yozilgan `<script>` yoki `<img onerror=…>` oddiy matn bo'lib chiqadi. Havola
 * faqat http(s), mailto va sayt ichidagi yo'l; rasm — https yoki `/uploads/…`.
 * Boshqa manzillar (javascript:, data:, //host) havola/rasm bo'lmaydi.
 *
 * Qo'llab-quvvatlanadi: `## H2`, `### H3`, paragraf, `**qalin**`, `*kursiv*`,
 * `[havola](url)`, `- ro'yxat`, `1. raqamli ro'yxat`, `> iqtibos`,
 * `> [!TIP]` maslahat bloki, `![rasm](url)`, `---` ajratkich.
 */
import { absoluteUploadUrl } from "../api.js";

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; external: boolean; children: Inline[] };

export type ContentBlock =
  | { kind: "p"; inlines: Inline[] }
  | { kind: "h2" | "h3"; id: string; text: string; inlines: Inline[] }
  | { kind: "ul" | "ol"; items: Inline[][] }
  | { kind: "quote" | "tip"; paragraphs: Inline[][] }
  | { kind: "img"; src: string; alt: string }
  | { kind: "hr" };

export interface TocItem {
  id: string;
  text: string;
}

const INLINE_RE = /\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_RE = /^\s*!\[([^\]]*)\]\(([^()\s]+)\)\s*$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d{1,3}[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const CALLOUT_RE = /^\[!(tip|note|important|info)\]$/i;

/** Maqoladan uzun maqola hisoblanadigan H2 soni — mundarija shundan boshlab chiqadi. */
export const TOC_MIN_HEADINGS = 3;

export function safeHref(raw: string): { href: string; external: boolean } | null {
  const url = raw.trim();
  if (/^https?:\/\/[^\s]+$/i.test(url)) return { href: url, external: true };
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return { href: url, external: true };
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return { href: url, external: false };
  return null;
}

export function safeImageSrc(raw: string): string | null {
  const url = raw.trim();
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return absoluteUploadUrl(url);
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  return null;
}

function pushText(out: Inline[], text: string) {
  const last = out[out.length - 1];
  if (last?.kind === "text") last.text += text;
  else out.push({ kind: "text", text });
}

/** Qator ichidagi belgilash. Havola ichida yana havola bo'lmaydi. */
export function parseInline(source: string, allowLinks = true): Inline[] {
  const out: Inline[] = [];
  let rest = source;
  while (rest) {
    const match = INLINE_RE.exec(rest);
    if (!match) {
      pushText(out, rest);
      break;
    }
    if (match.index > 0) pushText(out, rest.slice(0, match.index));
    if (match[1] !== undefined) {
      const link = allowLinks ? safeHref(match[2]) : null;
      const children = parseInline(match[1], false);
      if (link) out.push({ kind: "link", ...link, children });
      else for (const child of children) child.kind === "text" ? pushText(out, child.text) : out.push(child);
    } else if (match[3] !== undefined) {
      out.push({ kind: "strong", children: parseInline(match[3], allowLinks) });
    } else {
      out.push({ kind: "em", children: parseInline(match[4], allowLinks) });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

export function inlineText(inlines: Inline[]): string {
  return inlines.map((node) => (node.kind === "text" ? node.text : inlineText(node.children))).join("");
}

function headingId(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/['ʻʼ’‘`]/g, "")
      .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "bolim";
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function paragraphsOf(lines: string[]): string[] {
  const out: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim()) current.push(line.trim());
    else if (current.length) {
      out.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) out.push(current.join(" "));
  return out;
}

export function parseArticleContent(source: string): ContentBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  const ids = new Map<string, number>();
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length === 0) return;
    const inlines = parseInline(paragraph.join(" "));
    if (inlines.length) blocks.push({ kind: "p", inlines });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      const inlines = parseInline(heading[2]);
      const text = inlineText(inlines).trim();
      // H1 — sahifa sarlavhasi; matndagi "#" ham H2 bo'ladi (bitta sahifada bitta H1)
      if (text) blocks.push({ kind: heading[1].length <= 2 ? "h2" : "h3", id: headingId(text, ids), text, inlines });
      continue;
    }

    if (HR_RE.test(line)) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }

    const image = IMAGE_RE.exec(line);
    if (image) {
      flush();
      const src = safeImageSrc(image[2]);
      if (src) blocks.push({ kind: "img", src, alt: image[1].trim() });
      continue;
    }

    if (QUOTE_RE.test(line)) {
      flush();
      const body: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        body.push(QUOTE_RE.exec(lines[i])![1]);
        i++;
      }
      i--;
      const tip = body.length > 0 && CALLOUT_RE.test(body[0].trim());
      const paragraphs = paragraphsOf(tip ? body.slice(1) : body)
        .map((p) => parseInline(p))
        .filter((p) => p.length > 0);
      if (paragraphs.length) blocks.push({ kind: tip ? "tip" : "quote", paragraphs });
      continue;
    }

    if (UL_RE.test(line) || OL_RE.test(line)) {
      flush();
      const ordered = !UL_RE.test(line);
      const itemRe = ordered ? OL_RE : UL_RE;
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i];
        const item = itemRe.exec(current);
        if (item) {
          items.push(item[1]);
          i++;
          continue;
        }
        // Bandning davomi — bo'sh joy bilan boshlangan keyingi qator
        if (items.length && /^\s{2,}\S/.test(current) && !UL_RE.test(current) && !OL_RE.test(current)) {
          items[items.length - 1] += ` ${current.trim()}`;
          i++;
          continue;
        }
        break;
      }
      i--;
      const parsed = items.map((item) => parseInline(item.trim())).filter((item) => item.length > 0);
      if (parsed.length) blocks.push({ kind: ordered ? "ol" : "ul", items: parsed });
      continue;
    }

    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

export function tableOfContents(blocks: ContentBlock[]): TocItem[] {
  return blocks.flatMap((block) => (block.kind === "h2" ? [{ id: block.id, text: block.text }] : []));
}
