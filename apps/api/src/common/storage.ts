import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { env } from "./env.js";

/**
 * Yuklangan fayllar uchun saqlash qatlami: LOKAL DISK yoki S3-mos XOTIRA
 * (Cloudflare R2, AWS S3, Backblaze B2, MinIO, Supabase Storage...).
 *
 * Nega kerak (audit: storage-1): fayllar konteynerning o'z diskiga yozilardi.
 * Railway'da bu disk har deployda tozalanadi (Volume ulanmasa), Vercel kabi
 * serverless muhitda esa yozish umuman mumkin emas. Bundan ham muhimi: Volume'ni
 * bir nechta nusxa BAHAM KO'RA OLMAYDI — A nusxasiga yuklangan logo B nusxasida
 * 404 berardi, ya'ni saytni bir nechta nusxada ishlatib bo'lmasdi.
 *
 * S3 sozlanganda:
 *   - OCHIQ fayllar (logo, muqova) to'g'ridan-to'g'ri xotira/CDN manzilidan beriladi —
 *     API orqali o'tmaydi, ya'ni tezroq va serverga yuk tushmaydi;
 *   - YOPIQ fayllar (PDF rezyume) hech qachon ochiq berilmaydi: ular avvalgidek
 *     faqat vakolatli foydalanuvchiga API orqali oqim sifatida uzatiladi (D-058).
 *
 * Sozlanmasa — hammasi avvalgidek lokal diskda. Dev muhitda hech narsa o'zgarmaydi.
 */

export type Visibility = "public" | "private";

/**
 * Lokal papka (S3 sozlanmaganda). Railway'da Volume ulab `UPLOAD_DIR` bering,
 * aks holda fayllar deployda yo'qoladi.
 */
export const UPLOAD_DIR = env.UPLOAD_DIR ? path.resolve(env.UPLOAD_DIR) : path.join(process.cwd(), "uploads");

const s3Configured = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

export function storageKind(): "local" | "s3" {
  return s3Configured ? "s3" : "local";
}

/** Papka mavjudligini ta'minlaydi (faqat lokal rejimda ma'noga ega). */
export function ensureUploadDir(): void {
  if (s3Configured) return;
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * S3 klienti KERAK BO'LGANDA yaratiladi: S3 sozlanmagan deployda SDK umuman
 * yuklanmaydi (ishga tushish vaqti va xotira behuda ketmasin).
 */
type S3Client = import("@aws-sdk/client-s3").S3Client;
let clientPromise: Promise<S3Client> | null = null;

async function s3(): Promise<S3Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      return new S3Client({
        region: env.S3_REGION,
        // R2 va MinIO uchun o'z manzili; AWS S3 da bo'sh qoldiriladi
        ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
        // AWS SDK yangi versiyalari har so'rovga checksum sarlavhasi qo'shadi; S3'ga MOS
        // (lekin AWS bo'lmagan) xizmatlar — R2, MinIO, B2 — buni rad etishi mumkin.
        // "WHEN_REQUIRED" bilan checksum faqat haqiqatan talab qilinganda yuboriladi.
        requestChecksumCalculation: "WHEN_REQUIRED",
      });
    })();
  }
  return clientPromise;
}

/** Fayl nomidan to'liq S3 kaliti (`uploads/logo-abc.png`). */
function keyOf(name: string): string {
  return `${env.S3_PREFIX}${name}`;
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  svg: "image/svg+xml",
};

export function contentTypeOf(name: string): string {
  return CONTENT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/**
 * Faylni saqlaydi. Nom TASODIFIY va chaqiruvchi tomonidan tekshirilgan bo'lishi kerak
 * (`uploads.ts` ga qarang) — bu yerda faqat saqlash.
 */
export async function putFile(name: string, body: Buffer, visibility: Visibility): Promise<void> {
  if (!s3Configured) {
    ensureUploadDir();
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), body);
    return;
  }
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await s3();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: keyOf(name),
      Body: body,
      ContentType: contentTypeOf(name),
      // Nom tasodifiy va hech qachon o'zgarmaydi — brauzer va CDN uzoq keshlasin
      CacheControl: visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
    })
  );
}

/** Faylni o'qiydi (yopiq fayllarni API orqali uzatish uchun). Topilmasa `null`. */
export async function getFile(name: string): Promise<{ stream: Readable; size: number } | null> {
  if (!s3Configured) {
    const full = path.join(UPLOAD_DIR, name);
    try {
      const stat = await fs.promises.stat(full);
      if (!stat.isFile()) return null;
      return { stream: fs.createReadStream(full), size: stat.size };
    } catch {
      return null;
    }
  }
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    const res = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: keyOf(name) }));
    if (!res.Body) return null;
    return { stream: res.Body as Readable, size: Number(res.ContentLength ?? 0) };
  } catch {
    // Kalit yo'q yoki xotira javob bermadi — chaqiruvchi 404 qaytaradi
    return null;
  }
}

/** Faylni o'chiradi. Xato jim yutiladi — fayl allaqachon yo'q bo'lishi mumkin. */
export async function deleteFile(name: string): Promise<void> {
  if (!s3Configured) {
    await fs.promises.unlink(path.join(UPLOAD_DIR, name)).catch(() => undefined);
    return;
  }
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: keyOf(name) }));
  } catch {
    /* fayl yo'q yoki xotira javob bermadi */
  }
}

/** Berilgan prefiksli fayl nomlari (demo ma'lumotni tozalash uchun). */
export async function listFiles(prefix: string): Promise<string[]> {
  if (!s3Configured) {
    if (!fs.existsSync(UPLOAD_DIR)) return [];
    return (await fs.promises.readdir(UPLOAD_DIR)).filter((f) => f.startsWith(prefix));
  }
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const client = await s3();
  const names: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: keyOf(prefix), ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) names.push(obj.Key.slice(env.S3_PREFIX.length));
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return names;
}

/**
 * Bazaga yoziladigan havola.
 *
 * OCHIQ fayl S3'da bo'lsa — to'liq CDN manzili (`https://.../uploads/logo-x.png`):
 * brauzer rasmni to'g'ridan-to'g'ri xotiradan oladi, API orqali o'tmaydi.
 * Qolgan hollarda — avvalgi `/uploads/<nom>` shakli. YOPIQ fayl (rezyume) HAR DOIM
 * shu ichki shaklda saqlanadi: uni faqat vakolat tekshiradigan marshrut ochadi.
 *
 * Eski yozuvlar ham, yangilari ham ishlaydi: sayt `/...` bilan boshlangan qiymatni
 * API manziliga, to'liq havolani esa o'zgarishsiz ishlatadi (`absoluteUploadUrl`).
 */
export function fileUrl(name: string, visibility: Visibility): string {
  if (visibility === "public" && s3Configured && env.S3_PUBLIC_BASE_URL) {
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${keyOf(name)}`;
  }
  return `/uploads/${name}`;
}

/**
 * Saqlangan havoladan fayl NOMINI ajratadi va tekshiradi (audit R3, D-058).
 *
 * Havola `/uploads/<nom>` ham, to'liq CDN manzili ham bo'lishi mumkin. Nom faqat
 * kutilgan prefikslardan biri bilan boshlanishi va xavfsiz belgilardan iborat bo'lishi
 * shart — "../" yoki boshqa papkaga olib chiqadigan qiymat `null` qaytaradi.
 */
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

export function fileNameFromUrl(url: string | null | undefined, prefix: string | readonly string[]): string | null {
  if (!url) return null;
  const prefixes = typeof prefix === "string" ? [prefix] : prefix;
  const name = url.split("?")[0].split("/").pop() ?? "";
  if (!name || !SAFE_NAME.test(name) || name.includes("..")) return null;
  if (!prefixes.some((p) => name.startsWith(p))) return null;
  return name;
}
