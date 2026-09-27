/**
 * Demo seed uchun media fayllar: kompaniya logolari, ofis/jamoa rasmlari
 * (vektor sahnalar), nomzod avatarlari va PDF rezyumelar.
 *
 * Fayllar `UPLOAD_DIR` ichiga `demo-` prefiksi bilan yoziladi (`/uploads/demo-…`):
 * API ularni oddiy yuklangan fayl kabi beradi, logoni almashtirish/o'chirish
 * (`path.basename`) ham to'g'ri ishlaydi. `removeDemoFiles()` faqat shu prefiksli
 * fayllarni o'chiradi — foydalanuvchilar yuklagan fayllarga tegmaydi.
 */
import { deleteFile, fileUrl, listFiles, putFile } from "../common/storage.js";

const PREFIX = "demo-";

/**
 * Demo faylini saqlash qatlami orqali yozadi (lokal disk yoki S3 — sozlamaga qarab),
 * shuning uchun demo ma'lumot S3 ishlatadigan deployda ham to'g'ri ko'rinadi.
 * Rezyume YOPIQ fayl: havolasi ichki (`/uploads/demo-resume-…`), uni faqat vakolat
 * tekshiradigan marshrut ochadi (audit R3, D-058).
 */
export async function writeDemoFile(name: string, content: string | Buffer): Promise<string> {
  const filename = `${PREFIX}${name}`;
  const visibility = name.startsWith("resume-") ? "private" : "public";
  await putFile(filename, Buffer.isBuffer(content) ? content : Buffer.from(content), visibility);
  return fileUrl(filename, visibility);
}

export async function removeDemoFiles(): Promise<number> {
  const files = await listFiles(PREFIX);
  for (const f of files) await deleteFile(f);
  return files.length;
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** "Payla Fintech" -> "PF", "NextBrain" -> "N" (veb `CompanyLogo` bilan bir xil). */
export function initials(name: string): string {
  const words = name.replace(/["'’ʻ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0][0]).toUpperCase();
}

const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

// ------------------------------------------------------------------ logo

export function logoSvg(name: string, hue: number, variant: number): string {
  const mono = escapeXml(initials(name));
  const size = mono.length > 1 ? 88 : 112;
  const marks = [
    `<circle cx="196" cy="60" r="22" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="10"/>`,
    `<rect x="40" y="40" width="56" height="12" rx="6" fill="#fff" fill-opacity=".6"/><rect x="40" y="60" width="36" height="12" rx="6" fill="#fff" fill-opacity=".4"/>`,
    `<path d="M196 34l26 26-26 26-26-26z" fill="#fff" fill-opacity=".5"/>`,
    `<path d="M40 214c30-26 60-26 88 0s58 26 88 0" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="10" stroke-linecap="round"/>`,
    `<g fill="#fff" fill-opacity=".5"><circle cx="186" cy="50" r="7"/><circle cx="210" cy="50" r="7"/><circle cx="186" cy="74" r="7"/><circle cx="210" cy="74" r="7"/></g>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 72, 52)}"/><stop offset="1" stop-color="${hsl(hue + 28, 70, 38)}"/></linearGradient></defs>
<rect width="256" height="256" rx="60" fill="url(#g)"/>
${marks[variant % marks.length]}
<text x="128" y="${128 + size * 0.36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" letter-spacing="-2" fill="#fff">${mono}</text>
</svg>`;
}

export function avatarSvg(first: string, last: string, hue: number): string {
  const mono = escapeXml(`${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 65, 62)}"/><stop offset="1" stop-color="${hsl(hue + 35, 60, 42)}"/></linearGradient></defs>
<rect width="256" height="256" fill="url(#a)"/>
<circle cx="128" cy="104" r="44" fill="#fff" fill-opacity=".22"/>
<path d="M44 256c8-52 44-80 84-80s76 28 84 80z" fill="#fff" fill-opacity=".22"/>
<text x="128" y="150" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="700" fill="#fff">${mono}</text>
</svg>`;
}

// ------------------------------------------------------------------ sahnalar (1200×800)

type Scene = "office" | "team" | "workspace" | "building" | "meeting" | "lounge";
export const SCENES: Scene[] = ["office", "team", "workspace", "building", "meeting", "lounge"];

function person(x: number, y: number, scale: number, body: string, skin: string): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><rect x="-38" y="0" width="76" height="120" rx="36" fill="${body}"/><circle cx="0" cy="-34" r="30" fill="${skin}"/></g>`;
}

export function sceneSvg(scene: Scene, hue: number): string {
  const wall = hsl(hue, 38, 93);
  const wall2 = hsl(hue, 34, 86);
  const accent = hsl(hue, 70, 50);
  const accent2 = hsl(hue + 150, 55, 55);
  const dark = hsl(hue, 30, 22);
  const wood = "hsl(30 45% 58%)";
  const skins = ["hsl(28 55% 72%)", "hsl(25 45% 55%)", "hsl(32 60% 80%)", "hsl(20 40% 45%)"];
  const plant = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><rect x="-26" y="0" width="52" height="60" rx="8" fill="${dark}"/><ellipse cx="0" cy="-30" rx="20" ry="46" fill="hsl(140 40% 40%)"/><ellipse cx="-30" cy="-12" rx="16" ry="34" fill="hsl(140 45% 48%)" transform="rotate(-30 -30 -12)"/><ellipse cx="30" cy="-12" rx="16" ry="34" fill="hsl(140 45% 34%)" transform="rotate(30 30 -12)"/></g>`;
  let body = "";
  switch (scene) {
    case "office": {
      const windows = Array.from({ length: 4 }, (_, i) => `<rect x="${90 + i * 260}" y="90" width="220" height="300" rx="10" fill="hsl(205 70% 82%)"/><rect x="${90 + i * 260}" y="235" width="220" height="10" fill="${wall}"/>`).join("");
      const desks = [180, 600].map((x, i) => `<rect x="${x}" y="520" width="360" height="22" rx="6" fill="${wood}"/><rect x="${x + 20}" y="542" width="14" height="150" fill="${dark}"/><rect x="${x + 326}" y="542" width="14" height="150" fill="${dark}"/><rect x="${x + 120}" y="420" width="140" height="92" rx="8" fill="${dark}"/><rect x="${x + 130}" y="430" width="120" height="70" rx="4" fill="${i ? accent2 : accent}" fill-opacity=".85"/><rect x="${x + 180}" y="512" width="20" height="10" fill="${dark}"/>`).join("");
      body = `<rect width="1200" height="800" fill="${wall}"/>${windows}<rect y="690" width="1200" height="110" fill="${wall2}"/>${desks}${person(420, 560, 1, accent, skins[0])}${person(840, 560, 1, accent2, skins[1])}${plant(1080, 630)}`;
      break;
    }
    case "team": {
      const people = [
        [300, 430, accent, 0], [480, 400, accent2, 1], [700, 400, hsl(hue + 60, 50, 55), 2], [900, 430, dark, 3],
      ].map(([x, y, c, s]) => person(x as number, y as number, 1.2, c as string, skins[s as number])).join("");
      body = `<rect width="1200" height="800" fill="${wall}"/><rect x="120" y="80" width="360" height="220" rx="12" fill="#fff"/><rect x="150" y="120" width="180" height="16" rx="8" fill="${accent}"/><rect x="150" y="160" width="280" height="12" rx="6" fill="${wall2}"/><rect x="150" y="190" width="240" height="12" rx="6" fill="${wall2}"/><circle cx="900" cy="170" r="80" fill="${accent2}" fill-opacity=".25"/>${people}<ellipse cx="600" cy="640" rx="470" ry="90" fill="${wood}"/><ellipse cx="600" cy="628" rx="470" ry="90" fill="hsl(30 45% 66%)"/><rect x="420" y="585" width="90" height="12" rx="6" fill="#fff"/><rect x="690" y="600" width="110" height="14" rx="7" fill="${accent}" fill-opacity=".7"/>`;
      break;
    }
    case "workspace": {
      const lines = Array.from({ length: 8 }, (_, i) => `<rect x="${420 + (i % 3) * 30}" y="${200 + i * 34}" width="${160 + ((i * 53) % 180)}" height="14" rx="7" fill="${i % 2 ? accent : accent2}" fill-opacity=".8"/>`).join("");
      body = `<rect width="1200" height="800" fill="${wall2}"/><rect y="560" width="1200" height="240" fill="${wood}"/><rect x="360" y="140" width="520" height="340" rx="18" fill="${dark}"/><rect x="384" y="164" width="472" height="292" rx="8" fill="hsl(${hue} 25% 14%)"/>${lines}<rect x="590" y="480" width="60" height="60" fill="${dark}"/><rect x="520" y="540" width="200" height="20" rx="8" fill="${dark}"/><rect x="420" y="600" width="400" height="40" rx="10" fill="#eee"/><rect x="930" y="520" width="90" height="100" rx="14" fill="#fff"/><path d="M1020 545c34 0 34 50 0 50" fill="none" stroke="#fff" stroke-width="12"/><rect x="170" y="590" width="170" height="120" rx="6" fill="${accent}" transform="rotate(-8 255 650)"/>${plant(140, 500)}`;
      break;
    }
    case "building": {
      const win = Array.from({ length: 30 }, (_, i) => `<rect x="${380 + (i % 5) * 96}" y="${180 + Math.floor(i / 5) * 86}" width="64" height="54" rx="4" fill="hsl(205 70% ${i % 4 === 0 ? 88 : 72}%)"/>`).join("");
      body = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(205 80% 78%)"/><stop offset="1" stop-color="hsl(205 70% 93%)"/></linearGradient></defs><rect width="1200" height="800" fill="url(#sky)"/><circle cx="1010" cy="140" r="60" fill="hsl(45 95% 70%)"/><rect x="340" y="130" width="520" height="580" rx="10" fill="${dark}"/><rect x="340" y="110" width="520" height="30" rx="8" fill="${accent}"/>${win}<rect x="540" y="630" width="120" height="80" fill="hsl(205 60% 60%)"/><rect y="700" width="1200" height="100" fill="hsl(120 25% 60%)"/><rect y="700" width="1200" height="20" fill="hsl(0 0% 80%)"/>${plant(200, 640)}${plant(1000, 640)}`;
      break;
    }
    case "meeting": {
      const notes = Array.from({ length: 6 }, (_, i) => `<rect x="${200 + (i % 3) * 120}" y="${160 + Math.floor(i / 3) * 120}" width="96" height="96" rx="6" fill="hsl(${[48, hue, hue + 150][i % 3]} 85% 75%)"/>`).join("");
      const bars = [140, 210, 170, 260, 300].map((h, i) => `<rect x="${720 + i * 60}" y="${420 - h}" width="40" height="${h}" rx="6" fill="${i === 4 ? accent : accent2}"/>`).join("");
      body = `<rect width="1200" height="800" fill="${wall}"/><rect x="140" y="110" width="920" height="360" rx="16" fill="#fff" stroke="${wall2}" stroke-width="8"/>${notes}${bars}<rect x="700" y="420" width="320" height="6" fill="${wall2}"/>${person(330, 590, 1.1, accent, skins[2])}${person(880, 590, 1.1, dark, skins[1])}<rect y="730" width="1200" height="70" fill="${wall2}"/>`;
      break;
    }
    default: {
      body = `<rect width="1200" height="800" fill="${wall}"/><rect x="0" y="560" width="1200" height="240" fill="${wall2}"/><rect x="160" y="420" width="560" height="180" rx="60" fill="${accent}"/><rect x="190" y="360" width="500" height="120" rx="50" fill="${hsl(hue, 70, 60)}"/><rect x="820" y="160" width="220" height="280" rx="12" fill="#fff"/><circle cx="930" cy="260" r="60" fill="${accent2}" fill-opacity=".5"/><rect x="860" y="360" width="140" height="16" rx="8" fill="${wall2}"/><circle cx="960" cy="600" r="70" fill="${wood}"/><rect x="930" y="620" width="60" height="120" fill="${dark}"/>${plant(1080, 620)}${person(360, 330, 0.9, dark, skins[0])}${person(560, 330, 0.9, accent2, skins[3])}`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">${body}</svg>`;
}

// ------------------------------------------------------------------ PDF rezyume

/** Helvetica (WinAnsi) faqat lotin harflari — o'zbekcha apostrof va tirelar ASCII'ga. */
function pdfText(s: string): string {
  return s
    .replace(/[ʻʼ’‘`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\()]/g, (c) => `\\${c}`);
}

function wrap(text: string, width = 92): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if ((line + " " + word).trim().length > width) {
        out.push(line.trim());
        line = word;
      } else line += ` ${word}`;
    }
    out.push(line.trim());
  }
  return out;
}

/** Bir sahifali haqiqiy PDF (1.4): sarlavha + bo'limlar. */
export function resumePdf(title: string, subtitle: string, sections: { heading: string; lines: string[] }[]): Buffer {
  const ops: string[] = ["BT", "/F2 22 Tf", "56 780 Td", `(${pdfText(title)}) Tj`, "/F1 12 Tf", "0 -22 Td", `(${pdfText(subtitle)}) Tj`];
  let used = 2;
  for (const section of sections) {
    if (used > 44) break;
    ops.push("/F2 13 Tf", "0 -30 Td", `(${pdfText(section.heading)}) Tj`, "/F1 10.5 Tf");
    used += 2;
    for (const line of section.lines.flatMap((l) => wrap(l))) {
      if (used > 46) break;
      ops.push("0 -15 Td", `(${pdfText(line)}) Tj`);
      used++;
    }
  }
  ops.push("ET");
  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
