import React, { useEffect, useRef, useState } from "react";
import { useT, useHref } from "../lib/i18n/index.js";
import { useAuth } from "./AuthContext.js";
import { fetchTelegramStatus } from "../lib/api.js";
import { safeReturnTo } from "../lib/auth/returnTo.js";

/**
 * Telefon tasdiqlanmagani sababli amal bloklanganda ko'rsatiladigan eslatma.
 *
 * - `role="alert"` va fokus: amal to'xtaganini ekran o'quvchi ham biladi (audit R3, gap5-1).
 * - Havola to'g'ridan-to'g'ri profilning Telegram bo'limiga va `returnTo` bilan —
 *   tasdiqlagandan so'ng foydalanuvchi shu sahifaga qaytadi (audit R3, candidate-flows-14).
 * - Bot ishlamayotgan bo'lsa Rule K matni ko'rsatiladi (audit R3, api-errors-3).
 */
export function PhoneGateNotice({ className = "" }: { className?: string }) {
  const t = useT();
  const l = useHref();
  const { accessToken } = useAuth();
  const [unavailable, setUnavailable] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fokus faqat foydalanuvchi amalidan keyin ko'chiriladi (tugma hali fokusda bo'lsa).
    // Sahifa ochilishida (hech narsa fokusda emas — masalan ro'yxat so'rovi 403 qaytarsa)
    // fokusni o'g'irlash klaviatura foydalanuvchisini sahifa o'rtasiga tashlaydi; eslatma
    // baribir `role="alert"` bilan e'lon qilinadi (audit R3, gap5-1).
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return;
    boxRef.current?.focus();
  }, []);

  // Telegram holati: mavjud emas bo'lsa "profilga o'ting" o'rniga aniq sabab ko'rsatiladi.
  // Xato bo'lsa standart matn qoladi — holat noma'lumligi soxta xabar bermaydi.
  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    fetchTelegramStatus(accessToken).then(
      (status) => {
        if (alive) setUnavailable(status.available === false);
      },
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [accessToken]);

  const href = (() => {
    const base = l("/profile?tab=telegram");
    if (typeof window === "undefined") return base;
    const here = safeReturnTo(`${window.location.pathname}${window.location.search}`);
    return here ? `${base}&returnTo=${encodeURIComponent(here)}` : base;
  })();

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      role="alert"
      className={`animate-slide-down rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${className}`}
    >
      <p className="font-semibold text-ink">⚠️ {t.telegram.gateTitle}</p>
      <p className="mt-1 leading-relaxed text-dusk">
        {unavailable ? t.telegram.unavailable : t.telegram.gateMessage}
      </p>
      {!unavailable && (
        <a
          href={href}
          className="mt-2 inline-block font-semibold text-signal transition-colors hover:text-signal-dark"
        >
          {t.telegram.gateAction} →
        </a>
      )}
    </div>
  );
}

/** ApiError kodini tekshirish yordamchisi. */
export function isPhoneGateError(err: unknown): boolean {
  // 503 TELEGRAM_UNAVAILABLE ham gate: tasdiqlanmagan foydalanuvchi bot ishlamaganda Rule K xabarini
  // ko'rishi kerak (notice holatni o'zi tekshiradi). Ilgari u umumiy xato bo'lib chiqardi
  // (audit R3 ikkinchi audit, backend-12 / frontend-docs-5).
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === "PHONE_NOT_VERIFIED" || code === "TELEGRAM_UNAVAILABLE";
}
