import { prisma } from "../../common/prisma.js";
import { env } from "../../common/env.js";
import { sendTelegramMessage, tgEscape, type TgMessage } from "./telegram.api.js";

/**
 * Support relay: foydalanuvchi xabari -> admin chati va adminning javobi orqaga.
 */

// ---------------------------------------------------------
// Support relay
// ---------------------------------------------------------

/**
 * Admin chatidagi xabar ID'si -> foydalanuvchi chati (audit R3, files-xss-8, telegram-11).
 *
 * Ilgari yo'nalish xabar MATNIDAGI birinchi `#u<id>` bo'yicha topilardi, matn boshida esa
 * foydalanuvchi boshqaradigan ism turardi — u o'z ismiga `#u<boshqa chat>` yozib, adminning
 * javobini boshqa odamga yuborishi mumkin edi. Endi asosiy manba shu xotiradagi jadval,
 * matndagi belgi esa faqat BIRINCHI QATORdan va to'liq moslik bilan o'qiladi.
 */
const supportThreads = new Map<number, { chatId: string; expiresAt: number }>();
const SUPPORT_ROUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SUPPORT_ROUTE_MAX = 5000;

function rememberSupportThread(messageId: number | undefined, chatId: string): void {
  if (!messageId) return;
  const now = Date.now();
  if (supportThreads.size >= SUPPORT_ROUTE_MAX) {
    for (const [key, value] of supportThreads) {
      if (value.expiresAt <= now) supportThreads.delete(key);
    }
    if (supportThreads.size >= SUPPORT_ROUTE_MAX) {
      const oldest = supportThreads.keys().next().value;
      if (oldest !== undefined) supportThreads.delete(oldest);
    }
  }
  supportThreads.set(messageId, { chatId, expiresAt: now + SUPPORT_ROUTE_TTL_MS });
}

function lookupSupportThread(messageId: number | undefined): string | null {
  if (!messageId) return null;
  const entry = supportThreads.get(messageId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    supportThreads.delete(messageId);
    return null;
  }
  return entry.chatId;
}

/** Foydalanuvchi matnidagi "#u123" ko'rinishini zararsizlantiradi (yo'naltirish belgisiga o'xshamasin). */
function stripRoutingTag(text: string): string {
  return text.replace(/#u(?=-?\d)/gi, "# u");
}

export async function handleSupport(msg: TgMessage) {
  const chatId = String(msg.chat.id);
  const admin = env.TELEGRAM_ADMIN_CHAT_ID;

  if (!admin) {
    await sendTelegramMessage(
      chatId,
      "🛟 Xabaringiz qabul qilindi, lekin support hozircha sozlanmagan. Iltimos keyinroq urinib ko'ring."
    );
    return;
  }

  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
    select: { email: true, role: true },
  });
  const who = user ? `${user.email} (${user.role})` : `${msg.from?.first_name ?? "Noma'lum"} (saytga bog'lanmagan)`;

  // Yo'naltirish belgisi BIRINCHI QATORDA va foydalanuvchi matnidan oldin
  const sent = await sendTelegramMessage(
    admin,
    `#u${chatId}\n🛟 <b>Support xabari</b>\nKimdan: ${tgEscape(stripRoutingTag(who))}\n\n${tgEscape(
      stripRoutingTag(msg.text ?? "")
    )}`
  );
  if (!sent) {
    await sendTelegramMessage(chatId, "⚠️ Xabarni yuborib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
    return;
  }
  rememberSupportThread(sent.message_id, chatId);
  await sendTelegramMessage(chatId, "🛟 Xabaringiz qabul qilindi — tez orada javob beramiz.");
}

/** Admin support xabariga reply qilsa — javob foydalanuvchiga qaytadi. */
export async function handleAdminReply(msg: TgMessage) {
  const replied = msg.reply_to_message;
  const mapped = lookupSupportThread(replied?.message_id);
  // Zaxira yo'l (restartdan keyin): faqat BIRINCHI qatordagi to'liq `#u<id>` belgisi
  const firstLine = (replied?.text ?? "").split("\n", 1)[0].trim();
  const tagged = /^#u(-?\d+)$/.exec(firstLine)?.[1] ?? null;
  const target = mapped ?? tagged;
  if (!target) {
    await sendTelegramMessage(msg.chat.id, "⚠️ Javob yuborish uchun support xabariga reply qiling.");
    return;
  }
  const delivered = await sendTelegramMessage(target, `🛟 <b>Support javobi:</b>\n\n${tgEscape(msg.text ?? "")}`);
  await sendTelegramMessage(msg.chat.id, delivered ? "✅ Javob yuborildi." : "⚠️ Javobni yetkazib bo'lmadi.");
}
