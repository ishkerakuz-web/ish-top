import type { FastifyInstance } from "fastify";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { Errors } from "../../common/errors.js";
import { requireAuth } from "../../common/auth-guard.js";
import { boolish, idParams, isObjectId, safeInternalPath } from "../../common/validation.js";
import { getVapidPublicKey, isAllowedPushEndpoint } from "../../common/push.js";
import { features } from "../../common/env.js";

const NOTIFICATION_TYPES = [
  "new_application",
  "application_status_changed",
  "new_vacancy_match",
  "system",
] as const;

const CHANNELS = ["email", "push", "in_app", "telegram"] as const;

/**
 * Ro'yxat so'rovi (audit R3, D-078).
 *
 * `before` — oldingi sahifaning OXIRGI bildirishnomasi ID'si (keyset kursor).
 * `limit` sxemada 100 gacha qabul qilinadi (eski web 100 yuboradi — 400 bermasin),
 * yangi klient 1..50 ishlatadi.
 */
const listQuerySchema = z.object({
  unreadOnly: boolish().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().trim().max(64).optional(),
});

const DEFAULT_LIMIT = 30;

const prefSchema = z.object({
  items: z
    .array(
      z.object({
        notificationType: z.enum(NOTIFICATION_TYPES),
        channel: z.enum(CHANNELS),
        isEnabled: z.boolean(),
      })
    )
    .max(64),
});

const pushSubSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(255), auth: z.string().min(5).max(255) }),
});

/**
 * Notification.payload ichidagi `url` ni xavfsiz o'qiydi (faqat ichki yo'l).
 * "//host" va "/\host" ham "/" bilan boshlanadi, lekin brauzer ularni boshqa saytga
 * ochadi — rad etiladi (`safeInternalPath`, notify() bilan bir xil qoida).
 */
function urlFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  return safeInternalPath((payload as { url?: unknown }).url);
}

/**
 * Javobga chiqadigan `payload` (audit R3, D-059): web `payload.i18n` ni joriy tilda chizadi.
 * Ichidagi `url` xavfsiz tekshiruvdan o'tgan qiymatga almashtiriladi — tashqi manzil
 * ("//host") klientga umuman yetmasin (yuqoridagi `urlFromPayload` bilan bir xil qoida).
 */
function payloadForClient(payload: unknown, url: string | null): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return { ...(payload as Record<string, unknown>), url };
}

export async function notificationRoutes(app: FastifyInstance) {
  // Bildirishnomalar ro'yxati + o'qilmaganlar soni (qo'ng'iroq belgisi uchun)
  app.get("/api/notifications", { preHandler: [requireAuth] }, async (req) => {
    const { unreadOnly, limit, before } = listQuerySchema.parse(req.query);
    const userId = req.user!.sub;
    const take = limit ?? DEFAULT_LIMIT;

    // Kursor: o'sha yozuvdan ESKIROQLARI. `createdAt` bo'yicha tartiblanadi, shuning uchun
    // kursor yozuvining vaqti o'qiladi (demo/seed ma'lumotda ID tartibi vaqt tartibiga teng emas).
    // Yozuv o'chirilgan bo'lsa — ID bo'yicha zaxira taqqoslash (ObjectId vaqt bo'yicha o'sadi).
    let cursorWhere: object = {};
    if (before) {
      if (!isObjectId(before)) throw Errors.badRequest("before noto'g'ri");
      const anchor = await prisma.notification.findFirst({
        where: { id: before, userId },
        select: { createdAt: true },
      });
      cursorWhere = anchor
        ? {
            OR: [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lt: before } },
            ],
          }
        : { id: { lt: before } };
    }

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, ...(unreadOnly ? { isRead: false } : {}), ...cursorWhere },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        // Bittasi ortiqcha: yana sahifa borligini shundan bilamiz (audit R3, D-078)
        take: take + 1,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      items: page.map((n: (typeof rows)[number]) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        url: urlFromPayload(n.payload),
        // `payload.i18n` — web matnni joriy tilda chizadi (audit R3, D-059)
        payload: payloadForClient(n.payload, urlFromPayload(n.payload)),
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount,
      /** Keyingi sahifa uchun `?before=` qiymati; yana yozuv bo'lmasa `null`. */
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  });

  // Faqat sonini olish (header uchun yengil so'rov)
  app.get("/api/notifications/unread-count", { preHandler: [requireAuth] }, async (req) => {
    const count = await prisma.notification.count({
      where: { userId: req.user!.sub, isRead: false },
    });
    return { count };
  });

  app.post("/api/notifications/:id/read", { preHandler: [requireAuth] }, async (req) => {
    const { id } = idParams.parse(req.params);
    const found = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
    if (!found) throw Errors.notFound();
    if (found.userId !== req.user!.sub) throw Errors.forbidden();
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  });

  app.post("/api/notifications/read-all", { preHandler: [requireAuth] }, async (req) => {
    const res = await prisma.notification.updateMany({
      where: { userId: req.user!.sub, isRead: false },
      data: { isRead: true },
    });
    return { updated: res.count };
  });

  app.delete("/api/notifications/:id", { preHandler: [requireAuth] }, async (req) => {
    const { id } = idParams.parse(req.params);
    const found = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
    if (!found) throw Errors.notFound();
    if (found.userId !== req.user!.sub) throw Errors.forbidden();
    await prisma.notification.delete({ where: { id } });
    return { ok: true };
  });

  // ---------------------------------------------------------
  // Kanal sozlamalari
  // ---------------------------------------------------------

  // Sozlamalar jadvali: yozuv yo'q kanal — yoqilgan hisoblanadi
  app.get("/api/notifications/preferences", { preHandler: [requireAuth] }, async (req) => {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: req.user!.sub },
    });
    const disabled = new Set(
      rows
        .filter((r: { isEnabled: boolean }) => !r.isEnabled)
        .map((r: { notificationType: NotificationType; channel: NotificationChannel }) =>
          `${r.notificationType}:${r.channel}`
        )
    );

    const items = NOTIFICATION_TYPES.flatMap((notificationType) =>
      CHANNELS.map((channel) => ({
        notificationType,
        channel,
        isEnabled: !disabled.has(`${notificationType}:${channel}`),
        // Kanal serverda umuman sozlanmagan bo'lsa UI buni "mavjud emas" deb ko'rsatadi
        available:
          channel === "in_app" ||
          (channel === "email" && features.email) ||
          (channel === "push" && features.push) ||
          (channel === "telegram" && features.telegram),
      }))
    );
    return { items };
  });

  app.put("/api/notifications/preferences", { preHandler: [requireAuth] }, async (req) => {
    const { items } = prefSchema.parse(req.body);
    const userId = req.user!.sub;

    await prisma.$transaction(
      items.map((i) =>
        prisma.notificationPreference.upsert({
          where: {
            userId_notificationType_channel: {
              userId,
              notificationType: i.notificationType,
              channel: i.channel,
            },
          },
          update: { isEnabled: i.isEnabled },
          create: {
            userId,
            notificationType: i.notificationType,
            channel: i.channel,
            isEnabled: i.isEnabled,
          },
        })
      )
    );
    return { ok: true };
  });

  // ---------------------------------------------------------
  // Brauzer push obunasi
  // ---------------------------------------------------------

  app.get("/api/push/public-key", async () => ({ key: getVapidPublicKey() }));

  app.post("/api/push/subscribe", { preHandler: [requireAuth] }, async (req) => {
    if (!features.push) throw Errors.badRequest("Push xabarnomalar serverda sozlanmagan");
    const body = pushSubSchema.parse(req.body);
    // Faqat ma'lum push xizmatlari (audit R3, gap2-5): aks holda server obunada ko'rsatilgan
    // istalgan host:port ga chiquvchi so'rov yuborardi
    if (!isAllowedPushEndpoint(body.endpoint)) {
      throw Errors.badRequest("Push obunasi manzili qo'llab-quvvatlanmaydi");
    }
    const userId = req.user!.sub;
    const userAgent = String(req.headers["user-agent"] ?? "").slice(0, 255);

    // Bir brauzer obunasi bitta foydalanuvchiga tegishli. Shu qurilmada boshqa hisob kirsa, eski
    // egasining yozuvi o'chiriladi — yozuvni o'ziga "ko'chirib olish" o'rniga (audit ISSUE-084).
    await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: { not: userId } } });
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
      },
      create: {
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
      },
    });
    return { ok: true };
  });

  app.post("/api/push/unsubscribe", { preHandler: [requireAuth] }, async (req) => {
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
    // Baza xatosi yutilmaydi (audit R3, api-errors-10): ilgari o'chirish amalga oshmasa ham
    // javob `{ ok: true }` bo'lib, klient push'ni "o'chirildi" deb ko'rsatardi
    const res = await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.sub } });
    return { ok: true, removed: res.count };
  });
}
