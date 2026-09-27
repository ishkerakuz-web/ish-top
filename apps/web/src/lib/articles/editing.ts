/**
 * Maqola tahrirlash yordamchilari (admin muharriri): slug, matn hajmi, taxminiy
 * o'qish vaqti va Markdown asboblar paneli amallari. Server bilan bir xil
 * qoidalar (apps/api/src/modules/articles/articles.content.ts) — lekin yakuniy
 * tekshiruv baribir serverda.
 */
import { inlineText, parseArticleContent } from "./content.js";

/** Ko'rib chiqishga yuborish va chop etish uchun matnning eng kam hajmi (server bilan bir xil). */
export const MIN_PUBLISH_CHARS = 200;
export const TITLE_MAX = 160;
export const EXCERPT_MAX = 300;
export const META_TITLE_MAX = 70;
export const META_DESCRIPTION_MAX = 170;
export const MAX_TAGS = 10;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "",
  ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** "Rezyume qanday yoziladi?" -> "rezyume-qanday-yoziladi" (serverdagi slugifyText bilan bir xil). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’`ʻʼ]/g, "")
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Markdown belgilarisiz matn uzunligi. */
export function plainTextLength(content: string): number {
  return parseArticleContent(content)
    .map((block) => {
      switch (block.kind) {
        case "p":
        case "h2":
        case "h3":
          return inlineText(block.inlines);
        case "ul":
        case "ol":
          return block.items.map(inlineText).join(" ");
        case "quote":
        case "tip":
          return block.paragraphs.map(inlineText).join(" ");
        default:
          return "";
      }
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Ko'rib chiqish uchun taxminiy daqiqa (saqlanganda server aniq hisoblaydi). */
export function estimateReadingMinutes(content: string): number | null {
  const words = content.replace(/[#>*_`[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
  return words === 0 ? null : Math.max(1, Math.ceil(words / 200));
}

export type FormatKind = "h2" | "h3" | "bold" | "italic" | "ul" | "ol" | "link" | "quote" | "tip" | "divider";

export interface FormatResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function lineRange(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const newline = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
  const to = newline === -1 ? value.length : newline;
  return { from, to };
}

const PREFIX_RE: Record<"h2" | "h3" | "ul" | "ol" | "quote", RegExp> = {
  h2: /^##\s+/,
  h3: /^###\s+/,
  ul: /^[-*+]\s+/,
  ol: /^\d{1,3}[.)]\s+/,
  quote: /^>\s?/,
};

/**
 * Tanlangan matnga Markdown belgisini qo'llaydi. Qator belgilari (sarlavha,
 * ro'yxat, iqtibos) tanlangan har bir qatorga qo'yiladi va qayta bosilsa olinadi;
 * qalin/kursiv tanlovni o'raydi; bo'sh tanlovda namuna matn qo'yilib belgilanadi.
 */
export function applyFormat(value: string, start: number, end: number, kind: FormatKind, placeholder: string): FormatResult {
  const selected = value.slice(start, end);

  if (kind === "bold" || kind === "italic") {
    const mark = kind === "bold" ? "**" : "*";
    const text = selected || placeholder;
    const next = `${value.slice(0, start)}${mark}${text}${mark}${value.slice(end)}`;
    return { value: next, selectionStart: start + mark.length, selectionEnd: start + mark.length + text.length };
  }

  if (kind === "link") {
    const text = selected || placeholder;
    const url = "https://";
    const next = `${value.slice(0, start)}[${text}](${url})${value.slice(end)}`;
    const urlStart = start + text.length + 3;
    return { value: next, selectionStart: urlStart, selectionEnd: urlStart + url.length };
  }

  if (kind === "divider") {
    const before = value.slice(0, start);
    const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const insert = `${lead}---\n\n`;
    const next = `${before}${insert}${value.slice(end)}`;
    const caret = start + insert.length;
    return { value: next, selectionStart: caret, selectionEnd: caret };
  }

  if (kind === "tip") {
    const body = (selected || placeholder).split("\n").map((line) => `> ${line}`).join("\n");
    const before = value.slice(0, start);
    const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const insert = `${lead}> [!TIP]\n${body}\n`;
    const next = `${before}${insert}${value.slice(end)}`;
    const textStart = start + lead.length + "> [!TIP]\n> ".length;
    return { value: next, selectionStart: textStart, selectionEnd: textStart + (selected || placeholder).split("\n")[0].length };
  }

  // Qator belgilari
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const re = PREFIX_RE[kind];
  const prefixFor = (i: number) => (kind === "h2" ? "## " : kind === "h3" ? "### " : kind === "ul" ? "- " : kind === "ol" ? `${i + 1}. ` : "> ");
  // Bo'sh qatorda — belgi va namuna matn (belgilanib turadi, darhol yozish mumkin)
  if (lines.every((line) => !line.trim())) {
    const prefix = prefixFor(0);
    const insert = `${prefix}${placeholder}`;
    const next = `${value.slice(0, from)}${insert}${value.slice(to)}`;
    return { value: next, selectionStart: from + prefix.length, selectionEnd: from + insert.length };
  }
  const allMarked = lines.every((line) => !line.trim() || re.test(line));
  let counter = 0;
  const updated = lines.map((line) => {
    if (!line.trim()) return line;
    // Boshqa sarlavha/ro'yxat belgisi bo'lsa almashtiriladi
    const bare = line.replace(/^(#{1,6}\s+|[-*+]\s+|\d{1,3}[.)]\s+|>\s?)/, "");
    return allMarked ? bare : `${prefixFor(counter++)}${bare}`;
  });
  const replaced = updated.join("\n");
  const next = `${value.slice(0, from)}${replaced}${value.slice(to)}`;
  return { value: next, selectionStart: from, selectionEnd: from + replaced.length };
}
