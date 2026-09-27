import crypto from "node:crypto";
import type { FastifyRequest } from "fastify";
import { Errors } from "./errors.js";
import { deleteFile, fileNameFromUrl, fileUrl, putFile, type Visibility } from "./storage.js";

/**
 * Yuklangan fayllarni qabul qilish (kompaniya logosi, PDF rezyume, maqola muqovasi).
 *
 * Fayl QAYERGA yozilishini bu modul bilmaydi — u `storage.ts` ning ishi (lokal disk
 * yoki S3-mos xotira). Bu yerda faqat tekshiruvlar:
 *   - nomi tasodifiy (`<prefix><32 hex>.<ext>`) — userId yoki vaqtdan taxmin qilib topilmaydi (audit ISSUE-029);
 *   - turi mijoz yuborgan `Content-Type` ga emas, BIRINCHI BAYTLARGA qarab aniqlanadi (audit ISSUE-043):
 *     rasm nomi bilan HTML yoki SVG yuklab bo'lmaydi;
 *   - hajmi chegaradan oshsa 400.
 */

export { UPLOAD_DIR, ensureUploadDir } from "./storage.js";

export type UploadKind = "png" | "jpg" | "webp" | "pdf";

/** Multipart chegarasi bilan bir xil (server.ts): bundan kattasi qabul qilinmaydi. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Fayl turini birinchi baytlariga (magic bytes) qarab aniqlaydi (audit ISSUE-043).
 */
export function detectFileKind(buf: Buffer): UploadKind | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf.toString("ascii", 1, 4) === "PNG" &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

/**
 * Faqat shu ilova berilgan prefiks bilan yozgan faylni o'chiradi (demo va boshqa
 * fayllarga tegmaydi). Xato jim yutiladi — fayl allaqachon yo'q bo'lishi mumkin.
 */
export function removeUploadedFile(url: string | null | undefined, prefix: string): void {
  const name = fileNameFromUrl(url, prefix);
  if (!name) return;
  void deleteFile(name);
}

/** Saqlangan havoladan tekshirilgan fayl nomi (yopiq faylni berish uchun). */
export { fileNameFromUrl } from "./storage.js";

type UploadedFile = NonNullable<Awaited<ReturnType<FastifyRequest["file"]>>>;

const EXTENSIONS: Record<UploadKind, string> = { png: "png", jpg: "jpg", webp: "webp", pdf: "pdf" };

/**
 * Oqimni chegaralangan hajmda o'qiydi.
 *
 * Fayl avval XOTIRAGA o'qiladi, keyin tekshiriladi va faqat SHUNDAN KEYIN saqlanadi:
 * ilgari u avval diskka ".part" fayl sifatida yozilib, keyin tekshirilardi. Yangi
 * tartibda yaroqsiz fayl umuman saqlanmaydi va vaqtinchalik fayl qolib ketmaydi.
 * Hajm multipart darajasida ham (5MB, 1 fayl) cheklangani uchun xotira xavfsiz.
 */
async function readLimited(file: UploadedFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of file.file) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_BYTES) throw Errors.badRequest("Fayl juda katta (maksimal 5MB)");
    chunks.push(buf);
  }
  if (file.file.truncated) throw Errors.badRequest("Fayl juda katta (maksimal 5MB)");
  return Buffer.concat(chunks);
}

/**
 * Yuklangan faylni saqlaydi va bazaga yoziladigan havolani qaytaradi.
 *
 * `visibility`:
 *   - `"public"` — logo, muqova: S3 sozlangan bo'lsa to'g'ridan-to'g'ri CDN havolasi;
 *   - `"private"` — PDF rezyume: havola ichki (`/uploads/<nom>`), fayl hech qachon
 *     ochiq berilmaydi, faqat vakolat tekshiradigan marshrut orqali (audit R3, D-058).
 */
export async function saveUpload(
  file: UploadedFile,
  prefix: string,
  allowed: readonly UploadKind[],
  typeMessage: string,
  visibility: Visibility
): Promise<string> {
  const body = await readLimited(file);
  const kind = detectFileKind(body.subarray(0, 16));
  if (!kind || !allowed.includes(kind)) throw Errors.badRequest(typeMessage);

  const name = `${prefix}${crypto.randomBytes(16).toString("hex")}.${EXTENSIONS[kind]}`;
  await putFile(name, body, visibility);
  return fileUrl(name, visibility);
}
