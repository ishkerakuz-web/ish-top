import type { FastifyRequest } from "fastify";
import { env } from "./env.js";
import { bumpCounter, type CounterCollection } from "./counters.js";
import { firstTime, isBotRequest, viewerKey } from "./dedupe.js";

/**
 * Ko'rishni qayd etish (vakansiya va maqola sahifalari).
 *
 * Ilgari hisoblagich sahifa MA'LUMOTI so'ralganda oshardi. Uch kamchiligi bor edi:
 *   1. Bitta odam sahifani 10 marta yangilasa — 10 ta ko'rish.
 *   2. Har bir bot va havola ko'rinishini oladigan xizmat ham sanalardi.
 *   3. Sahifa ma'lumotini KESHLAB bo'lmasdi: har so'rov yon ta'sir qilardi.
 *
 * Endi ko'rish brauzerdan alohida yengil so'rov bilan keladi (`POST .../view`),
 * ko'ruvchi bo'yicha `VIEW_DEDUPE_SEC` davomida bir marta sanaladi va bazaga
 * darhol emas, buferdan yig'ib yoziladi (`counters.ts`).
 *
 * Slug bazadan TEKSHIRILMAYDI — bu yo'l eng ko'p chaqiriladigan yo'llardan biri
 * va qo'shimcha o'qish uning butun ma'nosini yo'qqa chiqarardi. Mavjud bo'lmagan
 * slug bazada hech bir hujjatga mos kelmaydi, ya'ni yozuv shunchaki bekorga ketadi.
 */
export interface ViewResult {
  /** Ko'rish hisoblandimi (takror, bot yoki noto'g'ri slug bo'lsa — `false`). */
  counted: boolean;
}

/** Slug shakli: ochiq sahifalardagi kabi kichik harf, raqam va chiziqcha. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function recordView(
  req: FastifyRequest,
  collection: CounterCollection,
  slug: string
): Promise<ViewResult> {
  if (!slug || slug.length > 200 || !SLUG.test(slug)) return { counted: false };
  if (isBotRequest(req)) return { counted: false };

  const viewer = viewerKey(req);
  const fresh = await firstTime(`view:${collection}:${slug}:${viewer}`, env.VIEW_DEDUPE_SEC);
  if (!fresh) return { counted: false };

  bumpCounter(collection, slug, "views_count");
  return { counted: true };
}
