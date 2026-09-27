import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { registerUser, loginUser, refreshSession, getMe, googleLogin, revokeUserSessions } from "./auth.service.js";
import { verifyRefreshToken, type RefreshTokenPayload } from "../../common/jwt.js";
import { requireAuth } from "../../common/auth-guard.js";
import { AppError } from "../../common/errors.js";
import { env, isProd } from "../../common/env.js";
import { assertQuota, HOUR_MS } from "../../common/quota.js";
import { passwordField } from "./password.js";
import { recoveryRoutes } from "./recovery.routes.js";
import { phoneRoutes } from "./phone.routes.js";

// Uzunliklar cheklangan (audit ISSUE-044): cheksiz parol argon2'ga, cheksiz ism bazaga ketardi
const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: passwordField,
  role: z.enum(["job_seeker", "employer"]),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  companyName: z.string().trim().max(160).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

/**
 * Refresh cookie sozlamalari.
 *
 * Prodda sayt (Vercel) va API (Railway) HAR XIL domenda turadi, ya'ni har bir
 * `/api/auth/refresh` so'rovi cross-site hisoblanadi. `sameSite: "lax"` bunday
 * so'rovga cookie'ni QO'SHMAYDI — foydalanuvchi har safar sahifani yangilaganda
 * seansdan chiqib ketardi. Shuning uchun prodda `sameSite: "none"` + `secure`
 * (brauzer "none" ni faqat HTTPS bilan qabul qiladi).
 *
 * Dev'da ikkalasi ham localhost (http) — u yerda "none" ishlamaydi, "lax" mos.
 */
const REFRESH_COOKIE = {
  httpOnly: true,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  secure: isProd,
  path: "/api/auth",
} as const;

export function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie("refreshToken", token, { ...REFRESH_COOKIE, maxAge: 60 * 60 * 24 * 30 });
}

function clearRefreshCookie(reply: FastifyReply) {
  // Tozalashda ham AYNAN o'sha atributlar bo'lishi shart, aks holda brauzer
  // boshqa cookie deb biladi va eskisi joyida qolib ketadi.
  reply.clearCookie("refreshToken", REFRESH_COOKIE);
}

// Brute-force himoyasi: login/register uchun umumiy limitdan qattiqroq chegara
const strictRateLimit = {
  config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
};

export async function authRoutes(app: FastifyInstance) {
  // Parolni tiklash va telefon oqimlari shu plugin ichida ro'yxatdan o'tadi (server.ts o'zgarmaydi)
  await app.register(recoveryRoutes);
  await app.register(phoneRoutes);

  app.post("/api/auth/register", strictRateLimit, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    // Ro'yxatdan o'tish javobi email mavjudligini bildiradi (409). Enumeration va argon2 yuki
    // qimmatga tushmasin: IP bo'yicha soatiga 30 ta hisob (audit R3, auth-core-14/gap3-4).
    // Chegara umumiy NAT ortidagi haqiqiy foydalanuvchilarga xalaqit qilmaydigan darajada keng.
    await assertQuota(`register:ip:${req.ip}`, 30, HOUR_MS);
    const tokens = await registerUser(body);
    setRefreshCookie(reply, tokens.refreshToken);
    return reply.send({ accessToken: tokens.accessToken });
  });

  app.post("/api/auth/login", strictRateLimit, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const tokens = await loginUser(body.email, body.password, req.ip);
    setRefreshCookie(reply, tokens.refreshToken);
    return reply.send({ accessToken: tokens.accessToken });
  });

  app.post("/api/auth/refresh", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    // Seans yo'qligi XATO emas — mehmon (guest) holati. 401 o'rniga 200 + null
    // qaytaramiz, aks holda brauzer konsolida keraksiz qizil xato ko'rinadi.
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return reply.send({ accessToken: null });
    try {
      const tokens = await refreshSession(refreshToken);
      setRefreshCookie(reply, tokens.refreshToken);
      return reply.send({ accessToken: tokens.accessToken });
    } catch (error) {
      // Faqat seans rad etilganda (yaroqsiz/bekor qilingan token, bloklangan hisob — 401/403) cookie tozalanadi
      // va guest sifatida davom etiladi. Baza uzilishi kabi vaqtinchalik xato global handler orqali 5xx bo'lib
      // qaytadi — klient seansni saqlab qoladi, cookie o'chmaydi (audit PHASE 6, U1).
      if (error instanceof AppError && (error.statusCode === 401 || error.statusCode === 403)) {
        clearRefreshCookie(reply);
        return reply.send({ accessToken: null });
      }
      throw error;
    }
  });

  // Logout seansni SERVERDA ham tugatadi (audit ISSUE-041): tokenVersion oshadi va shu foydalanuvchining
  // barcha refresh/access tokenlari (boshqa qurilmalar ham) yaroqsiz bo'ladi. Ilgari faqat cookie tozalanardi —
  // nusxalangan cookie 30 kun davomida yangi token olaverardi.
  app.post("/api/auth/logout", async (req, reply) => {
    const refreshToken = req.cookies.refreshToken;
    let payload: RefreshTokenPayload | null = null;
    if (refreshToken) {
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        /* yaroqsiz yoki muddati o'tgan cookie — faqat tozalaymiz */
      }
    }
    if (payload) {
      try {
        // Faqat JORIY seans cookie'si bekor qiladi (audit PHASE 6, U11): allaqachon bekor qilingan eski
        // (masalan o'g'irlangan) cookie tokenVersion'ni qayta oshirib, egasini hamma joydan chiqara olmasin.
        // Ochiq socketlar `revokeUserSessions` ichida yopiladi (audit R3, realtime-1).
        await revokeUserSessions(payload.sub, payload.v);
      } catch (err) {
        // Cookie baribir tozalanadi (avvalgi xatti-harakat); xato jim yutilmaydi — logga yoziladi
        req.log.warn({ err }, "logout: seansni serverda bekor qilib bo'lmadi");
      }
    }
    clearRefreshCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: [requireAuth] }, async (req) => {
    return getMe(req.user!.sub);
  });

  // Telegram orqali KIRISH olib tashlandi (audit R3, D-041; telegram-1, authz-idor-1, auth-core-1,
  // candidate-flows-1, admin-staff-4): bot parolsiz seans ochardi va bu seans "hamma joydan chiqish"
  // dan ham omon qolardi. Telegram endi faqat telefonni tasdiqlash va parolni tiklash kanali.

  // -------------------------------------------------------
  // Google orqali kirish (GIS ID token -> server tekshiruvi)
  // -------------------------------------------------------

  app.post("/api/auth/google", strictRateLimit, async (req, reply) => {
    if (!env.GOOGLE_CLIENT_ID) {
      return reply.status(503).send({
        error: "GOOGLE_OFF",
        message: "Google orqali kirish hozircha sozlanmagan.",
      });
    }
    const body = z
      .object({
        credential: z.string().min(20),
        role: z.enum(["job_seeker", "employer"]).optional(),
      })
      .parse(req.body);
    const tokens = await googleLogin(body.credential, body.role);
    setRefreshCookie(reply, tokens.refreshToken);
    return reply.send({ accessToken: tokens.accessToken });
  });
}
