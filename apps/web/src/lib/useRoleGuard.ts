import { useEffect } from "react";
import { useAuth } from "../components/AuthContext.js";
import { useHref } from "./i18n/index.js";
import { loginHrefWithReturn } from "./auth/returnTo.js";
import type { UserRole } from "./types.js";

/**
 * Faqat berilgan rolga ruxsat etilgan sahifalar uchun (masalan ish beruvchi paneli:
 * vakansiyalar, murojaatlar, nomzodlar). Mehmonni login sahifasiga, boshqa rolni
 * `wrongRoleRedirect`ga yo'naltiradi. Sahifaning o'z ma'lumot-yuklash effekti
 * `status === "authed" && user?.role === role` tekshiruvi bilan alohida yoziladi.
 */
export function useRequireRole(role: UserRole, wrongRoleRedirect: string) {
  const { status, user } = useAuth();
  const l = useHref();
  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest") {
      window.location.assign(loginHrefWithReturn(l("/login")));
      return;
    }
    if (user?.role !== role) {
      window.location.assign(l(wrongRoleRedirect));
    }
  }, [status, user, l]);
}

/**
 * Berilgan rol ushbu sahifaga umuman kira olmasligi kerak bo'lganda ishlatiladi
 * (masalan ish beruvchi ish-izlash bo'limlariga kirmasligi kerak). Mehmon va
 * boshqa rollar sahifada erkin qoladi.
 */
export function useRedirectRole(blockedRole: UserRole, redirectTo: string) {
  const { status, user } = useAuth();
  const l = useHref();
  useEffect(() => {
    if (status === "authed" && user?.role === blockedRole) {
      window.location.replace(l(redirectTo));
    }
  }, [status, user, l]);
}
