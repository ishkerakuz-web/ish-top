import { Prisma, type ApplicationStatus } from "@prisma/client";
import { z } from "zod";
import { isObjectId, objectId } from "../../common/validation.js";
import { prisma } from "../../common/prisma.js";
import { env, features } from "../../common/env.js";
import { sendToUser, isOnline } from "../../common/realtime.js";
import { keyedCache } from "../../common/cache.js";
import { consumeQuota, HOUR_MS } from "../../common/quota.js";
import { isChannelEnabled } from "../notifications/notifications.service.js";
import { notifyUserViaTelegram } from "../telegram/telegram.service.js";

/**
 * Chat xizmat qatlami: suhbatni topish/yaratish, xabar yetkazish, ro'yxat uchun
 * yordamchi so'rovlar va umumiy chegaralar.
 *
 * Ilgari bularning hammasi `chat.routes.ts` ichida edi (1000+ qator): REST marshrutlar,
 * WebSocket ishlovchisi va mantiq bir faylda aralashib yotardi. Endi uch qism:
 * bu fayl (mantiq), `chat.ws.ts` (real vaqt) va `chat.routes.ts` (REST).
 */

export async function participantsOf(conversationId: string) {
  if (!isObjectId(conversationId)) return null;
  const c = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { employerUserId: true, seekerUserId: true },
  });
  if (!c) return null;
  return { employerId: c.employerUserId, seekerId: c.seekerUserId };
}

/** Juftlik bo'yicha suhbatni topadi yoki yaratadi. */
export async function getOrCreateConversation(
  employerUserId: string,
  seekerUserId: string,
  companyId?: string | null
) {
  const existing = await prisma.conversation.findUnique({
    where: { employerUserId_seekerUserId: { employerUserId, seekerUserId } },
  });
  if (existing) {
    // Kompaniya konteksti keyinroq aniqlansa — yozib qo'yamiz
    if (!existing.companyId && companyId) {
      return prisma.conversation.update({ where: { id: existing.id }, data: { companyId } });
    }
    return existing;
  }
  try {
    const created = await prisma.conversation.create({
      data: { employerUserId, seekerUserId, companyId: companyId ?? null },
    });
    // Yangi suhbat — ikkala tomonning ID keshi darrov bekor qilinadi (audit R3, scale-10k-7)
    dropConversationIdsCache(employerUserId, seekerUserId);
    return created;
  } catch (error) {
    // Parallel so'rov suhbatni allaqachon yaratdi (unique juftlik) — o'shani qaytaramiz
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const created = await prisma.conversation.findUnique({
        where: { employerUserId_seekerUserId: { employerUserId, seekerUserId } },
      });
      if (created) {
        dropConversationIdsCache(employerUserId, seekerUserId);
        return created;
      }
    }
    throw error;
  }
}

/**
 * `/api/inbox/summary` uchun foydalanuvchining suhbat ID'lari (audit R3, scale-10k-7).
 *
 * Header hisoblagichi har ochiq varaqdan 20 soniyada bir marta keladi va har safar
 * foydalanuvchining BARCHA suhbatlari qayta o'qilardi. Endi ro'yxat 60 soniya keshlanadi;
 * yangi suhbat ochilganda kesh ikkala tomon uchun darrov bekor qilinadi, shuning uchun
 * yangi suhbatdagi birinchi xabar ham hisobga kechikmasdan tushadi.
 * Kesh faqat ID ro'yxati — o'qilmaganlar soni har safar bazadan hisoblanadi.
 */
const CONVERSATION_IDS_TTL_MS = 60_000;
const CONVERSATION_IDS_MAX_USERS = 5000;
const conversationIdsCache = new Map<string, { at: number; ids: string[] }>();

function dropConversationIdsCache(...userIds: string[]): void {
  for (const userId of userIds) conversationIdsCache.delete(userId);
}

export async function conversationIdsOf(userId: string): Promise<string[]> {
  const now = Date.now();
  const hit = conversationIdsCache.get(userId);
  if (hit && now - hit.at <= CONVERSATION_IDS_TTL_MS) return hit.ids;
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ employerUserId: userId }, { seekerUserId: userId }] },
    select: { id: true },
  });
  const ids = rows.map((c: { id: string }) => c.id);
  // Map qo'shilish tartibini saqlaydi: qayta yozishdan oldin o'chirsak, eng eski FOYDALANILGAN yozuv chiqadi
  conversationIdsCache.delete(userId);
  conversationIdsCache.set(userId, { at: now, ids });
  while (conversationIdsCache.size > CONVERSATION_IDS_MAX_USERS) {
    const oldest = conversationIdsCache.keys().next().value;
    if (oldest === undefined) break;
    conversationIdsCache.delete(oldest);
  }
  return ids;
}

/**
 * Xabarni saqlaydi va real-time yetkazadi: ikkala tomonning ochiq oynalariga WS orqali,
 * qabul qiluvchi saytda bo'lmasa — Telegram orqali. WS handler ham, ariza holati izohi ham
 * shu yagona yo'ldan o'tadi (audit ISSUE-060).
 */
export async function deliverMessage(
  conversationId: string,
  senderId: string,
  receiverId: string,
  body: string,
  clientId?: string
) {
  const saved = await prisma.message.create({
    data: { conversationId, senderId, body: body.slice(0, 4000) },
  });
  const message = {
    id: saved.id,
    conversationId,
    senderId,
    body: saved.body,
    isRead: false,
    createdAt: saved.createdAt,
  };
  // Yuboruvchi oynasi o'z `clientId`sini qaytarib oladi — "yuborilmoqda" pufagi shu bilan tasdiqlanadi
  sendToUser(senderId, JSON.stringify({ type: "message", message, ...(clientId ? { clientId } : {}) }));
  sendToUser(receiverId, JSON.stringify({ type: "message", message }));

  if (!(await isOnline(receiverId))) {
    void chatTelegramAlert(receiverId, conversationId).catch(() => undefined);
  }
  return saved;
}

/** Bitta suhbat bo'yicha Telegram ogohlantirishi orasidagi eng qisqa vaqt (audit R3, realtime-3). */
const CHAT_ALERT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Chat Telegram ogohlantirishi (audit R3, realtime-4 / D-078).
 *
 * 1. Bot sozlanmagan bo'lsa — hech narsa qilinmaydi (audit R3, realtime-5).
 * 2. Bitta suhbat bo'yicha 10 daqiqada ko'pi bilan bitta xabar: ilgari HAR bir xabar
 *    alohida Telegram so'rovi edi — bitta hisob suhbatdoshning Telegram'ini to'ldirib,
 *    Telegram global limitiga urib, boshqa foydalanuvchilarning xabarini kechiktirardi.
 * 3. Foydalanuvchining bildirishnoma sozlamasiga bo'ysunadi. Chat uchun alohida
 *    `NotificationType` yo'q (sxema o'zgarishi bu guruh mulki emas), shuning uchun eng yaqin
 *    mavjud tur — `system` + `telegram` kanali: "Tizim / Telegram" ni o'chirgan foydalanuvchi
 *    chat ogohlantirishini ham olmaydi va buning uchun Telegram'ni uzishi shart emas.
 * 4. Xabar MATNI yuborilmaydi (audit R3, telegram-13): ilgari shaxsiy xabarning birinchi
 *    200 belgisi Telegram'ga (va qurilma qulflangan ekraniga) chiqardi. Endi faqat
 *    "yangi xabar bor" signali va saytdagi havola boradi.
 */
async function chatTelegramAlert(receiverId: string, conversationId: string): Promise<void> {
  if (!features.telegram) return;
  if (!(await consumeQuota(`chat:tg:${receiverId}:${conversationId}`, 1, CHAT_ALERT_WINDOW_MS))) return;
  if (!(await isChannelEnabled(receiverId, "system", "telegram"))) return;
  await notifyUserViaTelegram(
    receiverId,
    `💬 <b>Yangi xabar keldi</b>\n\nSuhbatni saytda o'qishingiz mumkin.\n\n👉 ${env.WEB_ORIGIN}/messages`
  );
}

export const startSchema = z.object({
  candidateUserId: objectId().optional(),
  companySlug: z.string().max(200).optional(),
});

interface LastMessage {
  id: string;
  senderId: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

/** `aggregateRaw` Extended JSON qaytaradi: `{ $oid }`, `{ $date }`. */
const rawId = (value: unknown): string =>
  typeof value === "string" ? value : ((value as { $oid?: string } | null)?.$oid ?? "");
const rawDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  const inner = (value as { $date?: unknown } | null)?.$date;
  if (typeof inner === "string") return new Date(inner);
  if (inner && typeof inner === "object" && "$numberLong" in inner) return new Date(Number((inner as { $numberLong: string }).$numberLong));
  return new Date(0);
};

/**
 * Har suhbatning oxirgi xabari — bitta aggregatsiya (`[conversation_id, created_at]` indeksi bo'yicha).
 * Ilgari `include: { messages: { take: 1 } }` har suhbat uchun alohida so'rov berardi: 500 suhbatli ish
 * beruvchida ro'yxat p95 ~4 s edi (audit PHASE 5.3 benchmark).
 */
export async function lastMessages(conversationIds: string[]): Promise<Map<string, LastMessage>> {
  if (conversationIds.length === 0) return new Map();
  const rows = (await prisma.message.aggregateRaw({
    pipeline: [
      { $match: { conversation_id: { $in: conversationIds.map((id) => ({ $oid: id })) } } },
      { $sort: { conversation_id: -1, created_at: -1 } },
      {
        $group: {
          _id: "$conversation_id",
          messageId: { $first: "$_id" },
          senderId: { $first: "$sender_id" },
          // Ro'yxatda faqat qisqa ko'rinish kerak: to'liq matn (4000 belgigacha) har suhbat uchun
          // javob hajmini bekorga o'stirardi (audit R3, db-perf-7 / scale-10k-6)
          body: { $first: { $substrCP: [{ $ifNull: ["$body", ""] }, 0, LAST_MESSAGE_PREVIEW] } },
          isRead: { $first: "$is_read" },
          createdAt: { $first: "$created_at" },
        },
      },
    ],
  })) as unknown as { _id: unknown; messageId: unknown; senderId: unknown; body: unknown; isRead: unknown; createdAt: unknown }[];
  return new Map(
    rows.map((row) => [
      rawId(row._id),
      {
        id: rawId(row.messageId),
        senderId: rawId(row.senderId),
        body: typeof row.body === "string" ? row.body : "",
        isRead: row.isRead === true,
        createdAt: rawDate(row.createdAt),
      },
    ])
  );
}

/**
 * Suhbat kartasida maosh ko'rsatilmaydigan holatlar (audit ISSUE-033, audit R3 gap4-2):
 * e'lon egasi maoshni yashirgan yoki e'lon moderatsiyada/rad etilgan.
 */
export const hideSalary = (vacancy: { isSalaryHidden: boolean; status: string }): boolean =>
  vacancy.isSalaryHidden || vacancy.status === "moderation" || vacancy.status === "rejected";

/** Suhbat kontekstidagi arizani tanlash tartibi: taklif/qabul — faol muloqot, rad etilgan — oxirida. */
export const CONTEXT_RANK: Record<ApplicationStatus, number> = { invited: 0, accepted: 1, viewed: 2, sent: 3, rejected: 4 };

/**
 * Sahifalash chegaralari (audit R3, D-078 / db-perf-10 / scale-10k-9).
 * Suhbat tarixi ilgari bir javobda eng yangi 1000 ta xabarni (4 MB gacha) qaytarardi va
 * undan eskisiga umuman yetib bo'lmasdi; endi `?before=<messageId>` bilan orqaga yuriladi.
 */
export const MESSAGES_PAGE_DEFAULT = 50;
const MESSAGES_PAGE_MAX = 100;
/** Suhbatlar ro'yxati: bitta sahifa (audit R3, db-perf-7 / scale-10k-6). */
export const CONVERSATIONS_PAGE_DEFAULT = 30;
const CONVERSATIONS_PAGE_MAX = 50;
/** Ro'yxatdagi oxirgi xabar ko'rinishi (belgi). */
const LAST_MESSAGE_PREVIEW = 300;
/** Vakansiya konteksti uchun o'qiladigan arizalar chegarasi (sahifadagi nomzodlar bo'yicha). */
export const CONTEXT_APPLICATION_LIMIT = 1000;
/** Bir foydalanuvchi bir kunda ochadigan YANGI suhbatlar soni (audit R3, authz-idor-10). */
export const NEW_CONVERSATIONS_PER_DAY = 50;
export const DAY_MS = 24 * HOUR_MS;

/** WS: bitta ulanishdan 10 soniyada ko'pi bilan ~20 ta hodisa (token bucket). */
export const WS_BUCKET_CAPACITY = 20;
export const WS_REFILL_PER_MS = WS_BUCKET_CAPACITY / 10_000;
/** WS: bitta HISOB bir daqiqada yuboradigan xabarlar (barcha ulanishlari bo'yicha, audit R3, realtime-3). */
export const WS_MESSAGES_PER_MINUTE = 120;
/**
 * WS: bitta hisobning "o'qildi" kadrlari (audit R3, realtime-3). Har kadr `updateMany` so'rovi —
 * ulanish bo'yicha token bucket bir nechta ulanish bilan ko'paytirilardi. Chegara odatdagi
 * ishlatishdan ancha yuqori; oshib ketgan kadr jimgina tashlanadi (klient uchun zararsiz).
 */
export const WS_READS_PER_MINUTE = 300;

export const conversationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(CONVERSATIONS_PAGE_MAX).optional(),
  /** Oldingi sahifaning oxirgi suhbati: ID yoki uning `lastMessageAt` (ISO) qiymati. */
  before: z.string().trim().max(64).optional(),
});

export const messagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MESSAGES_PAGE_MAX).optional(),
  /** Shu xabardan ESKIROQLARI (oldingi sahifaning eng eski xabari ID'si). */
  before: z.string().trim().max(64).optional(),
});

/**
 * Ish beruvchining vakansiya ID'lari — 60 s kesh (audit R3, scale-10k-7).
 * Header hisoblagichi har 20 soniyada so'raladi va har safar barcha vakansiya ID'lari qayta o'qilardi.
 * Kesh vakansiya/kompaniya yozuvida `bumpDataVersion()` bilan ham bekor bo'ladi.
 */
export const cachedOwnedVacancyIds = keyedCache<string[]>(60_000, 2000);

export const rateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

/**
 * Baho berish sharti: suhbatda IKKALA tomon ham kamida bittadan xabar yozgan
 * bo'lishi kerak. Bir tomonlama yozib (javob olmasdan) baho qo'yib bo'lmaydi.
 */
export async function isMutualConversation(conversationId: string, a: string, b: string) {
  const [fromA, fromB] = await Promise.all([
    prisma.message.count({ where: { conversationId, senderId: a }, take: 1 }),
    prisma.message.count({ where: { conversationId, senderId: b }, take: 1 }),
  ]);
  return fromA > 0 && fromB > 0;
}
