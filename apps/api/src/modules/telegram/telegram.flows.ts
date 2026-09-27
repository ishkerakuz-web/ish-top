import { prisma } from "../../common/prisma.js";
import { env } from "../../common/env.js";
import { maskPhone, normalizePhone } from "../../common/phone.js";
import { recordSecurityEvent } from "../../common/security-events.js";
import {
  completeChallenge,
  findOpenChallenge,
  issueResetToken,
  latestAwaitingContact,
  markAwaitingContact,
  phoneOwner,
  telegramOwner,
  PAYLOAD_RE,
} from "../auth/challenges.js";
import { revokeUserSessions } from "../auth/auth.service.js";
import {
  CONTACT_KEYBOARD,
  MSG_INVALID,
  REMOVE_KEYBOARD,
  sendTelegramMessage,
  tgEscape,
  type TgMessage,
} from "./telegram.api.js";

/**
 * Bot oqimlari: /start, telefonni tasdiqlash va almashtirish, zaxira raqam, parolni tiklash.
 */
function siteButton(url: string, text: string): Record<string, unknown> | undefined {
  if (!/^https:\/\//i.test(url)) return undefined;
  return { reply_markup: { inline_keyboard: [[{ text, url }]] } };
}

/** Payloadsiz `/start` — saytga havola va botning vazifasi (D-046, Rule C). */
async function handleStartPlain(chatId: string) {
  const loginUrl = `${env.WEB_ORIGIN}/login`;
  await sendTelegramMessage(
    chatId,
    "👋 <b>ISH BOR!</b> botiga xush kelibsiz.\n\n" +
      `🔗 Saytga kirish: ${tgEscape(loginUrl)}\n\n` +
      "Bu bot faqat <b>telefon raqamni tasdiqlash</b> va <b>parolni tiklash</b> uchun ishlatiladi — " +
      "bot orqali saytga kirilmaydi.\n\n" +
      "• Telefonni tasdiqlash: saytdagi profil sahifasining Telegram bo'limidan boshlang.\n" +
      "• Parolni unutdingizmi? Kirish sahifasidagi «Parolni tiklash» ni tanlang.\n" +
      "• Savolingiz bo'lsa — shu yerga yozing, support jamoasi javob beradi.",
    siteButton(loginUrl, "ISH BOR! saytiga kirish")
  );
}

/** Maqsad bo'yicha kontakt so'rash matni. */
const CONTACT_PROMPT: Record<string, string> = {
  telegram_link:
    "📱 Telefon raqamingizni tasdiqlash uchun pastdagi tugmani bosing.\n\n" +
    "Faqat <b>o'z</b> raqamingizni ulashing — boshqa odamning kontakti qabul qilinmaydi.\n\n" +
    "⚠️ Bu havolani <b>siz</b> saytdan olmagan bo'lsangiz, raqamingizni ulashmang: " +
    "u boshqa odamning hisobini sizning raqamingiz bilan tasdiqlaydi.",
  phone_change:
    "📱 Yangi telefon raqamingizni tasdiqlash uchun pastdagi tugmani bosing.\n\n" +
    "⚠️ Raqam o'zgargach barcha qurilmalardagi seanslar tugaydi va qaytadan kirish kerak bo'ladi.",
  backup_phone:
    "📱 Zaxira raqamni tasdiqlash uchun pastdagi tugmani bosing.\n\n" +
    "Zaxira raqam asosiy raqamdan farq qilishi kerak — u parolni tiklashda ishlatiladi.",
  manual_recovery:
    "📱 Hisobni tiklash uchun yangi telefon raqamingizni tasdiqlang.\n\n" +
    "Tasdiqlangandan so'ng parolni o'rnatish havolasini shu yerga yuboramiz.",
};

export async function handleStart(msg: TgMessage, payload: string) {
  const chatId = String(msg.chat.id);

  if (!payload) return handleStartPlain(chatId);

  // Auth oqimlari faqat shaxsiy chatda (D-043, telegram-10): guruh chati identity emas
  if ((msg.chat.type ?? "private") !== "private" || !msg.from) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }
  const fromId = String(msg.from.id);

  // Format bazaga so'rovdan OLDIN tekshiriladi (D-046)
  if (!PAYLOAD_RE.test(payload)) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  const challenge = await findOpenChallenge(payload);
  if (!challenge) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  if (challenge.purpose === "password_recovery") {
    return handleRecoveryStart(chatId, fromId, challenge.id, challenge.userId, challenge.phoneKind);
  }

  if (!challenge.userId) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, isBlocked: true, telegramChatId: true },
  });
  if (!user || user.isBlocked) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  // Bitta Telegram identity — bitta hisob (D-043). Jim qayta bog'lash YO'Q.
  if (await telegramOwner(fromId, user.id)) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  // Zaxira raqam boshqa Telegram hisobida bo'lishi kerak (D-047)
  if (challenge.purpose === "backup_phone" && user.telegramChatId === fromId) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Zaxira raqam asosiy hisobingizdan BOSHQA Telegram hisobida bo'lishi kerak. " +
        "Zaxira raqam ulangan Telegram hisobidan havolani oching."
    );
    return;
  }

  // Qo'lda tiklash: so'rov tasdiqlangan va muddati o'tmagan bo'lishi shart (D-049)
  if (challenge.purpose === "manual_recovery" && !(await usableRecoveryRequest(challenge.recoveryRequestId))) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  if (!(await markAwaitingContact(challenge.id, fromId))) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }
  await sendTelegramMessage(chatId, CONTACT_PROMPT[challenge.purpose] ?? CONTACT_PROMPT.telegram_link, CONTACT_KEYBOARD);
}

/** Qo'lda tiklash so'rovi hali ishlatilishi mumkinmi (tasdiqlangan va 72 soat ichida). */
async function usableRecoveryRequest(requestId: string | null): Promise<boolean> {
  if (!requestId) return false;
  const request = await prisma.recoveryRequest.findUnique({
    where: { id: requestId },
    select: { status: true, continueExpiresAt: true },
  });
  if (!request || request.status !== "approved") return false;
  return (request.continueExpiresAt?.getTime() ?? 0) > Date.now();
}

/**
 * Parolni tiklash (D-045): identity hisobning asosiy yoki zaxira Telegram identity'si bilan
 * mos kelsa — reset havolasi yuboriladi. Mos kelmasa umumiy javob (hisob bor-yo'qligi bilinmaydi).
 */
async function handleRecoveryStart(
  chatId: string,
  fromId: string,
  challengeId: string,
  userId: string | null,
  phoneKind: string | null
) {
  if (!userId) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isBlocked: true, telegramChatId: true, backupTelegramId: true },
  });
  const expected = phoneKind === "backup" ? user?.backupTelegramId : user?.telegramChatId;
  if (!user || user.isBlocked || !expected || expected !== fromId) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }

  const reset = await issueResetToken(challengeId);
  if (!reset) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }
  recordSecurityEvent({ type: "recovery_verified", userId: user.id, meta: { phoneKind: phoneKind ?? "primary" } });

  const url = `${env.WEB_ORIGIN}/login?reset=${reset.token}`;
  await sendTelegramMessage(
    chatId,
    "🔐 <b>Parolni tiklash</b>\n\n" +
      `Yangi parol o'rnatish havolasi (15 daqiqa amal qiladi):\n${tgEscape(url)}\n\n` +
      "⚠️ Agar parolni tiklashni <b>siz</b> so'ramagan bo'lsangiz — bu xabarni e'tiborsiz qoldiring va havolani hech kimga bermang.",
    siteButton(url, "Yangi parol o'rnatish")
  );
}

// ---------------------------------------------------------
// Kontakt (telefon tasdiqlash)
// ---------------------------------------------------------

type ContactUser = {
  id: string;
  phone: string | null;
  isPhoneVerified: boolean;
  telegramChatId: string | null;
  backupPhone: string | null;
};

export async function handleContact(msg: TgMessage) {
  const chatId = String(msg.chat.id);
  const contact = msg.contact!;

  if ((msg.chat.type ?? "private") !== "private" || !msg.from) {
    await sendTelegramMessage(chatId, MSG_INVALID);
    return;
  }
  // Faqat O'ZINING kontakti qabul qilinadi (boshqa odamnikini yuborib bo'lmaydi)
  if (contact.user_id !== msg.from.id) {
    await sendTelegramMessage(chatId, "⚠️ Iltimos, tugma orqali o'z raqamingizni ulashing.", CONTACT_KEYBOARD);
    return;
  }
  const fromId = String(msg.from.id);

  // Faol challenge bo'lmasa telefon o'zgarmaydi (D-044): ilgari bog'langan chatdan
  // istalgan vaqtda kontakt yuborib raqamni almashtirish mumkin edi.
  const challenge = await latestAwaitingContact(fromId);
  if (!challenge || !challenge.userId) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Hozir tasdiqlanayotgan so'rov yo'q. Telefonni tasdiqlash yoki almashtirishni <b>saytdan</b> boshlang.",
      REMOVE_KEYBOARD
    );
    return;
  }

  const phone = normalizePhone(contact.phone_number);
  if (!phone) {
    await sendTelegramMessage(chatId, "⚠️ Telefon raqami tanilmadi. Saytdan qaytadan urinib ko'ring.", REMOVE_KEYBOARD);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, isBlocked: true, phone: true, isPhoneVerified: true, telegramChatId: true, backupPhone: true },
  });
  if (!user || user.isBlocked) {
    await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
    return;
  }

  // Telefon yagonaligi (D-043): tasdiqlangan raqam bir vaqtda faqat bitta hisobda
  if (await phoneOwner(phone, user.id)) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Bu telefon raqam boshqa hisobga biriktirilgan. Boshqa raqamdan foydalaning yoki qo'llab-quvvatlash xizmatiga murojaat qiling.",
      REMOVE_KEYBOARD
    );
    return;
  }

  switch (challenge.purpose) {
    case "telegram_link":
      return applyTelegramLink(chatId, fromId, challenge.id, user, phone);
    case "phone_change":
      return applyPhoneChange(chatId, fromId, challenge.id, user, phone);
    case "backup_phone":
      return applyBackupPhone(chatId, fromId, challenge.id, user, phone);
    case "manual_recovery":
      return applyManualRecovery(chatId, fromId, challenge.id, challenge.recoveryRequestId, user, phone);
    default:
      await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
  }
}

async function applyTelegramLink(chatId: string, fromId: string, challengeId: string, user: ContactUser, phone: string) {
  // Tasdiqlangan BOSHQA raqam bo'lsa — telefonni almashtirish oqimi kerak (D-044)
  if (user.isPhoneVerified && user.phone && user.phone !== phone) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Hisobingizda allaqachon boshqa tasdiqlangan raqam bor. Raqamni o'zgartirish uchun saytdagi " +
        "«Telefon raqamni o'zgartirish» oqimidan foydalaning.",
      REMOVE_KEYBOARD
    );
    return;
  }
  if (!(await completeChallenge(challengeId, "awaiting_contact"))) {
    await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
    return;
  }
  const identityChanged = user.telegramChatId !== fromId;
  await prisma.user.update({
    where: { id: user.id },
    data: { phone, isPhoneVerified: true, phoneVerifiedAt: new Date(), telegramChatId: fromId },
  });
  if (identityChanged) recordSecurityEvent({ type: "telegram_linked", userId: user.id, actorId: user.id });
  recordSecurityEvent({
    type: "phone_verified",
    userId: user.id,
    actorId: user.id,
    meta: { phone: maskPhone(phone) ?? "" },
  });

  await sendTelegramMessage(
    chatId,
    `✅ Telefon raqamingiz tasdiqlandi: <b>${tgEscape(phone)}</b>\n\n` +
      "Saytdagi profilingizda «Tasdiqlangan» belgisi paydo bo'ldi va yangi xabarlar shu yerga keladi.",
    REMOVE_KEYBOARD
  );
}

async function applyPhoneChange(chatId: string, fromId: string, challengeId: string, user: ContactUser, phone: string) {
  if (user.phone === phone) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Bu raqam allaqachon hisobingizda asosiy raqam sifatida turibdi.",
      REMOVE_KEYBOARD
    );
    return;
  }
  if (user.backupPhone === phone) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Bu raqam hisobingizda zaxira raqam sifatida turibdi. Avval zaxira raqamni olib tashlang.",
      REMOVE_KEYBOARD
    );
    return;
  }
  if (!(await completeChallenge(challengeId, "awaiting_contact"))) {
    await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
    return;
  }
  const previousIdentity = user.telegramChatId;
  await prisma.user.update({
    where: { id: user.id },
    data: { phone, isPhoneVerified: true, phoneVerifiedAt: new Date(), telegramChatId: fromId },
  });
  recordSecurityEvent({
    type: "phone_changed",
    userId: user.id,
    actorId: user.id,
    meta: { phone: maskPhone(phone) ?? "", previous: maskPhone(user.phone) ?? "" },
  });
  if (previousIdentity !== fromId) {
    if (previousIdentity) recordSecurityEvent({ type: "telegram_unlinked", userId: user.id, actorId: user.id });
    recordSecurityEvent({ type: "telegram_linked", userId: user.id, actorId: user.id });
  }
  // Tiklash kanali o'zgardi — barcha seanslar tugaydi (D-048, D-054)
  await revokeUserSessions(user.id);
  recordSecurityEvent({
    type: "sessions_invalidated",
    userId: user.id,
    actorId: user.id,
    meta: { reason: "phone_changed" },
  });

  await sendTelegramMessage(
    chatId,
    `✅ Asosiy telefon raqamingiz o'zgartirildi: <b>${tgEscape(phone)}</b>\n\n` +
      "🔐 Xavfsizlik uchun barcha qurilmalardagi seanslar tugatildi — saytga qaytadan kiring.",
    REMOVE_KEYBOARD
  );
}

async function applyBackupPhone(chatId: string, fromId: string, challengeId: string, user: ContactUser, phone: string) {
  if (user.phone === phone) {
    await sendTelegramMessage(chatId, "⚠️ Zaxira raqam asosiy raqamdan farq qilishi kerak.", REMOVE_KEYBOARD);
    return;
  }
  if (!(await completeChallenge(challengeId, "awaiting_contact"))) {
    await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { backupPhone: phone, backupPhoneVerifiedAt: new Date(), backupTelegramId: fromId },
  });
  recordSecurityEvent({
    type: "backup_phone_added",
    userId: user.id,
    actorId: user.id,
    meta: { phone: maskPhone(phone) ?? "" },
  });
  await sendTelegramMessage(
    chatId,
    `✅ Zaxira raqam tasdiqlandi: <b>${tgEscape(phone)}</b>\n\nEndi parolni shu raqam orqali ham tiklash mumkin.`,
    REMOVE_KEYBOARD
  );
  // Asosiy chatga ogohlantirish (D-047): o'g'irlangan seans zaxira raqam qo'shsa egasi bilib qoladi
  if (user.telegramChatId) {
    await sendTelegramMessage(
      user.telegramChatId,
      "🔐 <b>Xavfsizlik ogohlantirishi</b>\n\nHisobingizga zaxira telefon raqam qo'shildi " +
        `(${tgEscape(maskPhone(phone) ?? "")}). Agar bu siz bo'lmasangiz — darhol parolingizni o'zgartiring.`
    );
  }
}

async function applyManualRecovery(
  chatId: string,
  fromId: string,
  challengeId: string,
  recoveryRequestId: string | null,
  user: ContactUser,
  phone: string
) {
  if (!(await usableRecoveryRequest(recoveryRequestId))) {
    await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
    return;
  }
  // Reset tokeni challenge'ni `verified` ga o'tkazadi — shartli yozuv poygani ham hal qiladi
  const reset = await issueResetToken(challengeId);
  if (!reset) {
    await sendTelegramMessage(chatId, MSG_INVALID, REMOVE_KEYBOARD);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { phone, isPhoneVerified: true, phoneVerifiedAt: new Date(), telegramChatId: fromId },
  });
  recordSecurityEvent({ type: "phone_verified", userId: user.id, meta: { phone: maskPhone(phone) ?? "", manual: true } });
  recordSecurityEvent({ type: "telegram_linked", userId: user.id, meta: { manual: true } });

  // Ikkita xabar: avval klaviatura olib tashlanadi, keyin havola inline tugma bilan beriladi
  // (bitta xabarda `reply_markup` faqat bitta bo'lishi mumkin)
  await sendTelegramMessage(chatId, `✅ Telefon raqamingiz tasdiqlandi: <b>${tgEscape(phone)}</b>`, REMOVE_KEYBOARD);
  const url = `${env.WEB_ORIGIN}/login?reset=${reset.token}`;
  await sendTelegramMessage(
    chatId,
    `🔐 Yangi parol o'rnatish havolasi (15 daqiqa amal qiladi):\n${tgEscape(url)}`,
    siteButton(url, "Yangi parol o'rnatish")
  );
}
