import type { NotificationChannel, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../common/prisma.js";
import { env, features } from "../../common/env.js";
import { sendToUser } from "../../common/realtime.js";
import { sendMail, renderEmail, escapeHtml } from "../../common/mailer.js";
import { sendPushToUser } from "../../common/push.js";
import { safeInternalPath } from "../../common/validation.js";
import { notifyUserViaTelegram, tgEscape } from "../telegram/telegram.service.js";

/**
 * Bildirishnomalarning yagona kirish nuqtasi.
 *
 * Chaqiruvchi modul (ariza, chat, obuna...) faqat `notify()` ni chaqiradi —
 * qaysi kanalga borishini foydalanuvchining sozlamalari hal qiladi:
 *
 *   in_app   — bazaga yoziladi + saytda ochiq bo'lsa WebSocket orqali darrov
 *   telegram — bot bog'langan bo'lsa
 *   push     — brauzer obunasi bo'lsa (VAPID sozlangan bo'lsa)
 *   email    — SMTP sozlangan bo'lsa
 *
 * Sozlama yozuvi yo'q kanal — YOQILGAN hisoblanadi (foydalanuvchi hech narsa
 * o'zgartirmagan bo'lsa hammasi ishlaydi). O'chirish uchun aniq `false` yoziladi.
 */

/**
 * Bildirishnoma matnining tilga bog'liq kaliti (audit R3, D-059).
 *
 * `title`/`body` bazada O'ZBEKCHA saqlanadi (eski yozuvlar, Telegram, push va email shu matnni ishlatadi),
 * web esa `payload.i18n.key` ni joriy tilda chizadi. Parametrlar — oddiy qiymatlar (HTML emas),
 * ular ichida telefon raqami, token yoki kod bo'lmasligi kerak.
 */
export interface NotifyI18n {
  key: string;
  params?: Record<string, string | number>;
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  /** Qisqa matn — in-app ro'yxati, push va Telegram uchun. */
  body: string;
  /** Sayt ichidagi nisbiy yo'l, masalan "/messages". Tashqi manzil ("//host") e'tiborsiz qoladi. */
  url?: string;
  payload?: Prisma.InputJsonValue;
  /** Web uchun tarjima kaliti — `payload.i18n` bo'lib saqlanadi (D-059). */
  i18n?: NotifyI18n;
  /**
   * Sayt ichidagi ko'rsatishni MAJBURIY qiladi (audit R3, realtime-11): foydalanuvchi
   * `system` turini o'chirgan bo'lsa ham bildirishnoma bazaga yoziladi va qo'ng'iroqda ko'rinadi.
   * Tashqi kanallar (Telegram, push, email) baribir sozlamaga bo'ysunadi.
   */
  mandatoryInApp?: boolean;
  /** Email uchun kengaytirilgan HTML (berilmasa `body` ishlatiladi). */
  emailHtml?: string;
  /** Email tugmasi matni (url bilan birga). */
  ctaLabel?: string;
  /** Faqat shu kanallarga cheklash (default — hammasi). */
  channels?: NotificationChannel[];
  /**
   * `true` — tashqi kanallar (Telegram, push, email) tugashini kutadi, xatolari e'tiborsiz.
   * Ommaviy xabar tezlikni shu bilan boshqaradi: aks holda minglab so'rov bir zumda ketardi (audit PHASE 6, V9).
   */
  awaitChannels?: boolean;
}

const ALL_CHANNELS: NotificationChannel[] = ["in_app", "telegram", "push", "email"];

const ignore = () => undefined;

/** Foydalanuvchining shu tur uchun o'chirib qo'ygan kanallarini qaytaradi. */
async function disabledChannels(
  userId: string,
  type: NotificationType
): Promise<Set<NotificationChannel>> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, notificationType: type, isEnabled: false },
    select: { channel: true },
  });
  return new Set(rows.map((r: { channel: NotificationChannel }) => r.channel));
}

/**
 * Kanal shu tur uchun yoqilganmi (yozuv yo'q — yoqilgan hisoblanadi) VA serverda sozlanganmi.
 * Chat Telegram ogohlantirishi shu tekshiruvdan o'tadi (audit R3, realtime-4).
 */
export async function isChannelEnabled(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel
): Promise<boolean> {
  if (!channelAvailable(channel)) return false;
  const off = await disabledChannels(userId, type);
  return !off.has(channel);
}

/** Kanal serverda umuman sozlanganmi (audit R3, realtime-5 / gap3-2). */
function channelAvailable(channel: NotificationChannel): boolean {
  if (channel === "in_app") return true;
  if (channel === "telegram") return features.telegram;
  if (channel === "push") return features.push;
  return features.email;
}

function isJsonObject(value: Prisma.InputJsonValue | undefined): value is Prisma.InputJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Sayt ichida o'chirib bo'lmaydigan turkumlar (audit R3, realtime-11).
 *
 * Sxemada atigi 4 ta `NotificationType` bor va moderatsiya natijasi, kompaniya tasdig'i,
 * xavfsizlik xabari hamda admin ommaviy xabari — hammasi `system`. "Tizim + sayt ichida" ni
 * o'chirgan foydalanuvchi ilgari vakansiyasi NEGA rad etilganini yoki tasdiq belgisi nega
 * olinganini umuman bilmasdi. Yangi enum qiymatlari sxema o'zgarishini talab qiladi (bu guruh
 * mulki emas), shuning uchun turkum `payload.i18n.key` prefiksidan aniqlanadi (D-059 kalitlari):
 * `security.`, `vacancy.`, `company.` — sayt ichida doim ko'rsatiladi; Telegram, push va email
 * baribir sozlamaga bo'ysunadi. Admin ommaviy xabarida i18n kaliti yo'q — u avvalgidek o'chiriladi.
 */
const MANDATORY_IN_APP_PREFIXES = ["security.", "vacancy.", "company."];

/** `i18n.key` — to'g'ridan-to'g'ri berilgan yoki chaqiruvchi `payload` ichiga yozgan bo'lsa ham. */
function i18nKeyOf(input: NotifyInput): string | null {
  if (typeof input.i18n?.key === "string") return input.i18n.key;
  const nested = plainObject(plainObject(input.payload)?.i18n);
  return typeof nested?.key === "string" ? nested.key : null;
}

function isMandatoryInApp(input: NotifyInput): boolean {
  if (input.mandatoryInApp) return true;
  const key = i18nKeyOf(input);
  return key !== null && MANDATORY_IN_APP_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Hech qachon reject qilmaydi (audit ISSUE-013): chaqiruvchilar `void notify(...)` qiladi —
 * ilgari baza xatosi tutilmagan promise bo'lib, Node jarayonini yiqitishi mumkin edi.
 * Bildirishnoma yuborilmasa asosiy amal (ariza, holat o'zgarishi) baribir muvaffaqiyatli.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await deliver(input);
  } catch (error) {
    console.warn("[notify] bildirishnoma yuborilmadi:", (error as Error)?.message ?? error);
  }
}

/**
 * `awaitChannels` bo'lganda tashqi kanallarni kutish chegarasi. SMTP va web-push'da cheklangan timeout yo'q:
 * bitta osilgan ulanish ommaviy xabarni daqiqalab to'xtatmasin. Chegara o'tsa yuborish fonda davom etadi
 * (xatolari yutiladi), navbatdagi foydalanuvchiga o'tiladi (audit PHASE 6, V9 review).
 */
const EXTERNAL_WAIT_MS = 20_000;

async function deliver(input: NotifyInput): Promise<void> {
  const wanted = input.channels ?? ALL_CHANNELS;
  const off = await disabledChannels(input.userId, input.type);
  // Kanal serverda sozlanmagan bo'lsa umuman ishlatilmaydi (audit R3, realtime-5 / gap3-2):
  // ilgari SMTP'siz prodda har bildirishnoma foydalanuvchi emailini o'qib logga yozardi,
  // tokensiz Telegram esa bo'sh token bilan api.telegram.org ga so'rov yuborardi.
  // Moderatsiya, kompaniya tasdig'i va xavfsizlik xabarlari sayt ichida o'chirilmaydi (audit R3, realtime-11)
  const mandatoryInApp = isMandatoryInApp(input);
  const use = (c: NotificationChannel) =>
    wanted.includes(c) && channelAvailable(c) && (!off.has(c) || (c === "in_app" && mandatoryInApp));

  const url = safeInternalPath(input.url);
  const absoluteUrl = url ? `${env.WEB_ORIGIN}${url}` : env.WEB_ORIGIN;

  // Havola doim payload ichida (audit ISSUE-014): ilgari `payload` berilsa `url` yo'qolib,
  // ro'yxatdagi bildirishnoma hech qayerga olib bormasdi.
  // `i18n` — web uchun tarjima kaliti (audit R3, D-059); chaqiruvchi to'g'ridan-to'g'ri
  // `payload.i18n` yozgan bo'lsa ham saqlanadi.
  const extra = isJsonObject(input.payload) ? input.payload : {};
  const payload: Prisma.InputJsonObject = {
    ...extra,
    ...(input.i18n ? { i18n: { key: input.i18n.key, params: input.i18n.params ?? {} } } : {}),
    url,
  };

  // 1) In-app: bazaga yozamiz va ochiq sahifaga darrov uzatamiz
  if (use("in_app")) {
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload,
      },
    });
    sendToUser(
      input.userId,
      JSON.stringify({
        type: "notification",
        notification: {
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          url,
          // Web `payload.i18n` ni joriy tilda chizadi (D-059); eski klient bu maydonni e'tiborsiz qoldiradi
          payload,
          isRead: false,
          createdAt: row.createdAt,
        },
      })
    );
  }

  // Tashqi kanallar: xatolari doim yutiladi. Sukut bo'yicha kutilmaydi (asosiy amal sekinlashmasin);
  // `awaitChannels` bo'lsa hammasi tugashi kutiladi — ommaviy xabar tezlikni shu bilan boshqaradi (audit PHASE 6, V9)
  const external: Promise<unknown>[] = [];
  const wantsExternal = use("telegram") || use("push") || use("email");
  if (!wantsExternal) return;

  // Bloklangan hisobga tashqi kanallar yuborilmaydi (audit R3, gap2-4): bitta o'qish bilan
  // ham blok holati, ham email olinadi (ilgari email kanali alohida so'rov qilardi).
  const user = await prisma.user
    .findUnique({ where: { id: input.userId }, select: { email: true, isBlocked: true } })
    .catch(() => null);
  if (!user || user.isBlocked) return;

  // 2) Telegram
  if (use("telegram")) {
    external.push(
      notifyUserViaTelegram(
        input.userId,
        `<b>${tgEscape(input.title)}</b>\n${tgEscape(input.body)}\n\n👉 ${absoluteUrl}`
      ).catch(ignore)
    );
  }

  // 3) Brauzer push
  if (use("push")) {
    external.push(
      sendPushToUser(input.userId, {
        title: input.title,
        body: input.body,
        url: url ?? "/",
        tag: input.type,
      }).catch(ignore)
    );
  }

  // 4) Email
  if (use("email")) {
    external.push(sendUserEmail(input, absoluteUrl, user.email).catch(ignore));
  }

  if (input.awaitChannels && external.length > 0) {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled(external),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, EXTERNAL_WAIT_MS);
        timer.unref?.();
      }),
    ]);
    if (timer) clearTimeout(timer);
  }
}

async function sendUserEmail(input: NotifyInput, absoluteUrl: string, email: string | null): Promise<void> {
  if (!email) return;
  await sendMail({
    to: email,
    subject: input.title,
    html: renderEmail({
      title: input.title,
      body: input.emailHtml ?? `<p style="margin:0">${escapeHtml(input.body)}</p>`,
      ctaLabel: input.ctaLabel ?? "Saytda ochish",
      ctaHref: absoluteUrl,
    }),
  });
}

/** Bir nechta foydalanuvchiga bir xil bildirishnoma (ketma-ket, DB'ni bosmaslik uchun). */
export async function notifyMany(userIds: string[], build: (userId: string) => NotifyInput) {
  for (const id of userIds) {
    await notify(build(id));
  }
}
