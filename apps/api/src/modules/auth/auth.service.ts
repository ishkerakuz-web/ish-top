import crypto from "node:crypto";
import argon2 from "argon2";
import type { UserRole } from "@prisma/client";
import { prisma } from "../../common/prisma.js";
import { Errors, AppError } from "../../common/errors.js";
import { env } from "../../common/env.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../common/jwt.js";
import { uniqueSlug } from "../../common/slug.js";
import { bumpDataVersion } from "../../common/cache.js";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "../../common/login-guard.js";
import { closeUserSockets } from "../../common/realtime.js";
import { cancelOpenChallenges } from "./challenges.js";
import { assertPasswordAcceptable } from "./password.js";

/** Foydalanuvchi topilmaganda ham argon2 tekshiruvi bajariladi — javob vaqti hisob mavjudligini oshkor qilmasin. */
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash("timing-equalizer-not-a-real-password");
  return dummyHashPromise;
}

interface RegisterInput {
  email: string;
  password: string;
  role: "job_seeker" | "employer";
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

/**
 * Email har doim kichik harfda saqlanadi va taqqoslanadi. Aks holda
 * "Ali@mail.uz" bilan ro'yxatdan o'tgan odam "ali@mail.uz" bilan kira olmasdi
 * va bir xil pochtaga ikkita hisob ochilib ketardi.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  // Oson topiladigan parol va emailning o'zi rad etiladi (audit R3, auth-core-15)
  assertPasswordAcceptable(input.password, email);

  // Hash AVVAL hisoblanadi (audit R3, auth-core-14/gap3-4): mavjud va yangi email uchun javob vaqti
  // bir xil bo'ladi. Xabar hali ham aniq (409) — UI ro'yxatdan o'tishni kirishga almashtira olishi kerak;
  // enumeration'ga qarshi asosiy chora — endpoint limiti va IP kvotasi (auth.routes.ts).
  const passwordHash = await argon2.hash(input.password);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Errors.conflict("Bu email bilan foydalanuvchi allaqachon mavjud");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: input.role,
      ...(input.role === "job_seeker"
        ? {
            jobSeekerProfile: {
              create: {
                firstName: input.firstName ?? "",
                lastName: input.lastName ?? "",
              },
            },
          }
        : {}),
    },
  });

  // Ish beruvchi ro'yxatdan o'tishda kompaniya nomini kiritsa — kompaniya darrov yaratiladi
  if (user.role === "employer" && input.companyName?.trim()) {
    const name = input.companyName.trim();
    await prisma.company.create({
      data: { ownerUserId: user.id, name, slug: uniqueSlug(name, "kompaniya") },
    });
    // Bosh sahifa statistikasi va kompaniyalar katalogi keshi yangi kompaniyani darhol ko'rsin (audit PHASE 6)
    bumpDataVersion();
  }

  return issueTokens(user.id, user.role, user.tokenVersion);
}

/**
 * Admin bloklagan hisob seans ocha olmaydi. Bu tekshiruv seans berish nuqtalarida
 * turadi (login / refresh / Telegram / Google); allaqachon berilgan access token esa
 * har so'rovda requireAuth'da bazadan tekshiriladi — blok darhol kuchga kiradi (audit PHASE 6, V5).
 */
function assertNotBlocked(user: { isBlocked: boolean }) {
  if (user.isBlocked) {
    throw new AppError(
      403,
      "USER_BLOCKED",
      "Hisobingiz vaqtincha bloklangan. Sabab va tiklash uchun qo'llab-quvvatlash xizmatiga murojaat qiling."
    );
  }
}

export async function loginUser(email: string, password: string, ip: string) {
  const normalized = normalizeEmail(email);
  // Noto'g'ri urinishlar `email|ip` bo'yicha sanaladi (audit R3, D-052): bitta manba faqat o'zini
  // bloklaydi, qurbonni emas. Email bo'yicha yuqori shift taqsimlangan hujumni sekinlashtiradi.
  assertLoginAllowed(normalized, ip);
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    await argon2.verify(await dummyHash(), password).catch(() => false);
    recordLoginFailure(normalized, ip);
    throw Errors.unauthorized("Email yoki parol noto'g'ri");
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    recordLoginFailure(normalized, ip);
    throw Errors.unauthorized("Email yoki parol noto'g'ri");
  }
  assertNotBlocked(user);
  clearLoginFailures(normalized);

  return issueTokens(user.id, user.role, user.tokenVersion);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      jobSeekerProfile: { select: { firstName: true, lastName: true } },
      staffProfile: { select: { fullName: true } },
    },
  });
  if (!user) throw Errors.unauthorized();
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    // Kontent jamoasi a'zosida ism StaffProfile'da (bitta maydon) — header shuni ko'rsatadi
    firstName: user.jobSeekerProfile?.firstName ?? user.staffProfile?.fullName ?? null,
    lastName: user.jobSeekerProfile?.lastName ?? null,
  };
}

export async function refreshSession(refreshToken: string) {
  let payload: { sub: string; v: number };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw Errors.unauthorized("Refresh token yaroqsiz");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw Errors.unauthorized();
  // Logout, bloklash yoki rol o'zgarganda tokenVersion oshadi — eski refresh tokenlar yaroqsiz (audit ISSUE-041)
  if (payload.v !== (user.tokenVersion ?? 0)) throw Errors.unauthorized("Seans tugagan");
  assertNotBlocked(user);

  return issueTokens(user.id, user.role, user.tokenVersion);
}

export function issueTokens(userId: string, role: UserRole, tokenVersion?: number | null) {
  return {
    // Access token ham seans versiyasini olib yuradi — revokeUserSessions uni ham darhol bekor qiladi (audit PHASE 6, V5)
    accessToken: signAccessToken({ sub: userId, role, v: tokenVersion ?? 0 }),
    refreshToken: signRefreshToken({ sub: userId, v: tokenVersion ?? 0 }),
  };
}

/**
 * Foydalanuvchining barcha seanslarini bekor qiladi (logout, bloklash, rol o'zgarishi): tokenVersion oshadi.
 * Refresh tokenlar ham, `v` li access tokenlar ham DARHOL yaroqsiz bo'ladi — requireAuth har so'rovda
 * bazadagi versiya bilan solishtiradi (audit PHASE 6, V5). `v` siz eski access tokenlar muddati
 * (15 daqiqa) tugaguncha qoladi, lekin rol va blok holati baribir bazadan olinadi.
 *
 * `expectedVersion` berilsa, faqat joriy versiya unga teng bo'lganda bekor qiladi (logout, audit PHASE 6, U11):
 * allaqachon bekor qilingan eski cookie egasini qayta-qayta hamma qurilmadan chiqara olmasin.
 * Qaytaradi: versiya oshirildimi.
 */
export async function revokeUserSessions(userId: string, expectedVersion?: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  if (!user) return false;
  const current = user.tokenVersion ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== current) return false;
  // Holat keshi shu yozuv bilan avtomatik bekor bo'ladi (common/prisma.ts kengaytmasi)
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: current + 1 } });
  // Ochiq Telegram challenge'lari va berilgan reset tokenlari ham bekor (audit R3 ikkinchi audit, backend-1):
  // aks holda eski phone_change / telegram_link / reset tokeni parol tiklash, qo'lda tiklash yoki
  // telefon almashtirishdan keyin ham ishlab, tiklash kanalini hujumchiga qaytarishi mumkin edi.
  await cancelOpenChallenges(userId);
  // Ochiq WebSocket ulanishlari ham shu yerda yopiladi (audit R3, realtime-1): ilgari har bir
  // chaqiruvchi `closeUserSockets` ni ALOHIDA chaqirishi kerak edi va yangi oqim (parol tiklash,
  // telefon almashtirish, qo'lda tiklash) buni unutishi mumkin edi.
  // 4403: klient qayta ulanmaydi (bloklash, rol o'zgarishi, parol tiklash) — 4401 da klient refresh qilib qayta urinardi
  closeUserSockets(userId);
  return true;
}

interface GoogleTokenInfo {
  aud?: string;
  iss?: string;
  email?: string;
  email_verified?: string;
  given_name?: string;
  family_name?: string;
  exp?: string;
}

/**
 * Google ID token'ni Google'ning o'zida tekshiramiz (tokeninfo) — qo'shimcha
 * kutubxonasiz. aud bizning CLIENT_ID'ga mos va email tasdiqlangan bo'lishi shart.
 */
async function verifyGoogleCredential(credential: string): Promise<GoogleTokenInfo> {
  let res: Response;
  try {
    res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new AppError(503, "GOOGLE_UNAVAILABLE", "Google bilan bog'lanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
  if (!res.ok) throw Errors.unauthorized("Google token yaroqsiz");
  const info = (await res.json()) as GoogleTokenInfo;
  if (info.aud !== env.GOOGLE_CLIENT_ID) throw Errors.unauthorized("Google token boshqa ilovaga tegishli");
  if (info.iss && info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
    throw Errors.unauthorized("Google token yaroqsiz");
  }
  if (info.email_verified !== "true" || !info.email) {
    throw Errors.unauthorized("Google email tasdiqlanmagan");
  }
  return info;
}

export async function googleLogin(credential: string, role?: "job_seeker" | "employer") {
  const info = await verifyGoogleCredential(credential);
  const email = normalizeEmail(info.email!);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    assertNotBlocked(existing);
    // Audit R3, D-055 (authz-idor-7, auth-core-4, candidate-flows-8, data-integrity-5):
    // ilgari Google bilan kirish shu email'dagi ISTALGAN hisobga seans ochardi — parol bilan
    // ochilgan, emaili tasdiqlanmagan hisobni oldindan egallab olish mumkin edi. Endi faqat
    // emaili tasdiqlangan (Google orqali yaratilgan yoki taklif bilan ochilgan) ODDIY hisoblar
    // kiradi; admin va kontent jamoasi hisoblari har doim parol bilan kiradi.
    const mergeable = existing.isEmailVerified && (existing.role === "job_seeker" || existing.role === "employer");
    if (!mergeable) {
      throw new AppError(
        409,
        "GOOGLE_ACCOUNT_EXISTS",
        "Bu email bilan hisob mavjud. Email va parol bilan kiring."
      );
    }
    return issueTokens(existing.id, existing.role, existing.tokenVersion);
  }

  // Hisob yo'q: rol berilmagan bo'lsa (login sahifasi) — ro'yxatdan o'tishga yo'naltiramiz
  if (!role) {
    throw new AppError(404, "NEED_SIGNUP", "Bu Google hisobi bilan foydalanuvchi topilmadi. Avval ro'yxatdan o'ting.");
  }

  // Google foydalanuvchisida parol yo'q — tasodifiy hash saqlanadi
  // (parol bilan kira olmaydi; xohlasa keyin tiklash orqali o'rnatadi).
  const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      isEmailVerified: true,
      ...(role === "job_seeker"
        ? {
            jobSeekerProfile: {
              create: {
                firstName: (info.given_name ?? "").slice(0, 60),
                lastName: (info.family_name ?? "").slice(0, 60),
              },
            },
          }
        : {}),
    },
  });
  return issueTokens(user.id, user.role, user.tokenVersion);
}
