import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "./env.js";

/**
 * JWT qoidalari (audit ISSUE-009):
 * - faqat HS256 qabul qilinadi — `algorithms` aniq berilgan, kutubxona defaultiga tayanilmaydi;
 * - access va refresh tokenlar `typ` bilan ajratiladi, biri ikkinchisining o'rniga o'tmaydi;
 * - refresh va access token `v` (User.tokenVersion) ni olib yuradi — logout, bloklash yoki rol
 *   o'zgarganda versiya oshadi va eski tokenlar bekor bo'ladi (access token'ni requireAuth bazadagi
 *   versiya bilan solishtiradi — audit PHASE 6, V5).
 * `typ`/`v` siz eski tokenlar (fix'dan oldin berilgan) muddati tugaguncha qabul qilinadi.
 */
const ALGORITHM = "HS256" as const;
/** `sub` — MongoDB ObjectId; boshqa ko'rinishdagi qiymat bazaga so'rov bo'lib ketmaydi (audit PHASE 6, V5). */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface AccessTokenPayload {
  sub: string; // userId
  role: UserRole;
  /** Muddati (unix soniya) — WebSocket ulanishini token tugaganda yopish uchun. */
  exp?: number;
  /** Seans versiyasi (User.tokenVersion). Eski tokenlarda yo'q — ular muddati tugaguncha qabul qilinadi. */
  v?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  v: number;
}

type Decoded = jwt.JwtPayload & { role?: UserRole; typ?: unknown; v?: unknown };

export function signAccessToken(payload: { sub: string; role: UserRole; v?: number | null }) {
  return jwt.sign({ sub: payload.sub, role: payload.role, v: payload.v ?? 0, typ: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
    algorithm: ALGORITHM,
  });
}

export function signRefreshToken(payload: { sub: string; v?: number | null }) {
  return jwt.sign({ sub: payload.sub, v: payload.v ?? 0, typ: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
    algorithm: ALGORITHM,
  });
}

function decode(token: string, secret: string, expected: "access" | "refresh"): Decoded & { sub: string } {
  const decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  if (typeof decoded === "string" || typeof decoded.sub !== "string" || !OBJECT_ID.test(decoded.sub)) {
    throw new Error("Token yaroqsiz");
  }
  const typ = (decoded as Decoded).typ;
  if (typ !== undefined && typ !== expected) throw new Error("Token turi noto'g'ri");
  return decoded as Decoded & { sub: string };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const d = decode(token, env.JWT_ACCESS_SECRET, "access");
  if (!d.role) throw new Error("Token yaroqsiz");
  // `v` faqat yangi tokenlarda bor; yo'q bo'lsa versiya solishtirilmaydi (audit PHASE 6, V5)
  return { sub: d.sub, role: d.role, exp: d.exp, ...(typeof d.v === "number" ? { v: d.v } : {}) };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const d = decode(token, env.JWT_REFRESH_SECRET, "refresh");
  return { sub: d.sub, v: typeof d.v === "number" ? d.v : 0 };
}
