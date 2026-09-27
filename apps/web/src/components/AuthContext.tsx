import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchMeResult, logoutUser } from "../lib/api.js";
import {
  bumpSessionEpoch,
  getAccessToken,
  installAuthFetch,
  readStoredToken,
  refreshSession,
  setAccessToken,
} from "../lib/auth/session.js";
import type { CurrentUser } from "../lib/types.js";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthState {
  user: CurrentUser | null;
  status: AuthStatus;
  /**
   * Seans tokeni — faqat kirish/chiqishda o'zgaradi. Fonda yangilangan token `lib/auth/session.ts`da
   * saqlanadi va API so'rovlariga avtomatik qo'yiladi (sahifalar qayta yuklanmasin; audit ISSUE-019).
   */
  accessToken: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Access token ~15 daqiqa yashaydi — undan oldin yangilanadi. */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

// Mehmon (kirmagan foydalanuvchi) uchun konsolda bir marta tushunarli xabar.
let guestNoticeShown = false;
function logGuestNotice() {
  if (guestNoticeShown || typeof window === "undefined") return;
  guestNoticeShown = true;
  console.info(
    "%cISH BOR! 👋%c\nSiz tizimga kirmagansiz — mehmon rejimidasiz.\nRo'yxatdan o'tish yoki kirish uchun yuqoridagi tugmalardan foydalaning.",
    "font-size:22px;font-weight:800;color:#1E88E5;line-height:1.6;",
    "font-size:13px;color:#475569;line-height:1.6;",
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  /** Har kirish/chiqishda oshadi: kechikib kelgan eski javob yangi holatni yozib yubormasin (audit ISSUE-020). */
  const generation = useRef(0);
  const lastRefresh = useRef(0);

  const becomeGuest = useCallback(() => {
    generation.current += 1;
    // Yarim yo'lda qolgan refresh tokenni qaytarib yozmasin (audit PHASE 6, U20)
    bumpSessionEpoch();
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  // So'rov 401 olib, refresh ham seans yo'qligini tasdiqlasa — mehmon holatiga o'tiladi
  useEffect(() => {
    installAuthFetch(becomeGuest);
  }, [becomeGuest]);

  // Mount'da seansni tiklaymiz: saqlangan token -> bo'lmasa/eskirgan bo'lsa httpOnly refresh cookie.
  // Tarmoq yoki server xatosi "mehmon" degani emas: token o'chirilmaydi, holat "loading" qoladi va qayta urinadi.
  useEffect(() => {
    const gen = generation.current;
    let cancelled = false;
    let timer = 0;
    let attempt = 0;
    const stale = () => cancelled || gen !== generation.current;

    const authed = (token: string, u: CurrentUser) => {
      setAccessToken(token);
      lastRefresh.current = Date.now();
      setToken(token);
      setUser(u);
      setStatus("authed");
    };
    const retryLater = () => {
      timer = window.setTimeout(() => void restore(), Math.min(30_000, 2000 * 2 ** attempt));
      attempt += 1;
    };

    const restore = async () => {
      const stored = readStoredToken();
      if (stored) {
        const me = await fetchMeResult(stored);
        if (stale()) return;
        if (me.kind === "ok") return authed(stored, me.user);
        if (me.kind === "error") return retryLater();
      }
      const fresh = await refreshSession();
      if (stale()) return;
      if (fresh === undefined) return retryLater();
      if (fresh) {
        const me = await fetchMeResult(fresh);
        if (stale()) return;
        if (me.kind === "ok") return authed(fresh, me.user);
        if (me.kind === "error") return retryLater();
      }
      setAccessToken(null);
      setToken(null);
      setUser(null);
      setStatus("guest");
      logGuestNotice();
    };

    void restore();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // Fonda yangilash: React holati o'zgarmaydi, faqat token do'koni. Seans bekor qilingan bo'lsa — mehmon.
  useEffect(() => {
    if (status !== "authed") return;
    const gen = generation.current;
    const run = async () => {
      const fresh = await refreshSession();
      if (gen !== generation.current) return;
      if (fresh) lastRefresh.current = Date.now();
      else if (fresh === null) becomeGuest();
    };
    const id = window.setInterval(() => void run(), REFRESH_INTERVAL_MS);
    // Uxlab qolgan tab (interval to'xtab qoladi) qaytganda token eskirgan bo'lishi mumkin
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > REFRESH_INTERVAL_MS) void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, becomeGuest]);

  const login = useCallback(async (token: string) => {
    generation.current += 1;
    const gen = generation.current;
    // Oldingi seans uchun boshlangan refresh yangi tokenni almashtirib yubormasin (audit PHASE 6, U20)
    bumpSessionEpoch();
    setAccessToken(token);
    lastRefresh.current = Date.now();
    setToken(token);
    const me = await fetchMeResult(token);
    if (gen !== generation.current) return;
    if (me.kind === "ok") {
      setUser(me.user);
      setStatus("authed");
      return;
    }
    bumpSessionEpoch();
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  const logout = useCallback(async () => {
    generation.current += 1;
    const gen = generation.current;
    // Token do'koni DARHOL tozalanadi: kechikib tugagan refresh tokenni qaytarib yozmaydi (audit PHASE 6, U20).
    // `logoutUser` Bearer emas, httpOnly cookie bilan ishlaydi — token kerak emas.
    bumpSessionEpoch();
    setAccessToken(null);
    try {
      await logoutUser();
    } catch {
      /* server bilan bog'lanmasa ham lokal seansni tozalaymiz */
    }
    // Kutish paytida boshqa hisobga kirilgan bo'lsa — yangi seans o'chirilmaydi
    if (gen !== generation.current) return;
    // Kutish paytida boshlangan refresh (cookie hali bekor qilinmagan edi) natijasi ham tashlanadi
    bumpSessionEpoch();
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, status, accessToken, login, logout }),
    [user, status, accessToken, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth faqat AuthProvider ichida ishlatilishi kerak");
  return ctx;
}

/** Hozirgi (eng yangi) access token — ulanish ochish kabi render'dan tashqari joylar uchun. */
export { getAccessToken };
