import React, { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n/index.js";
import { useAuth } from "./AuthContext.js";
import { ApiError, fetchTelegramStatus, requestTelegramLink } from "../lib/api.js";
import { safeReturnTo } from "../lib/auth/returnTo.js";
import type { TelegramStatus } from "../lib/types.js";
import { Skeleton } from "./Skeleton.js";
import { PhoneSecurity } from "./profile/PhoneSecurity.js";
import { Button, Card } from "./profile/ui.js";
import { IconArrowRight, IconCheck, IconRefresh, IconTelegram } from "./profile/icons.js";

/**
 * Telegram bog'lash + telefon tasdiqlash + telefon xavfsizligi.
 *
 * - `card` (standart): ish beruvchi profili uchun umumiy karta.
 * - `panel`: nomzod profilidagi alohida integratsiya bo'limi (afzalliklar bilan).
 * - `compact`: dashboard'dagi qisqa karta, `onOpen` bilan to'liq bo'limga o'tadi.
 *
 * Rule K (audit R3, D-051): bot ishlamayotgan bo'lsa tugma o'chiriladi va
 * "hozircha mavjud emas" matni ko'rsatiladi — xom server matni emas.
 *
 * Foydalanuvchi Telegramdan qaytib kelganda (sahifa yana ko'rinsa) holat
 * o'zi yangilanadi — «Yangilash» tugmasi zaxira sifatida qoladi.
 */
export function TelegramConnect({
  variant = "card",
  onStatusChange,
  onOpen,
  openHref,
}: {
  variant?: "card" | "panel" | "compact";
  onStatusChange?: (status: TelegramStatus) => void;
  onOpen?: () => void;
  openHref?: string;
}) {
  const t = useT();
  const hub = t.profileHub.telegram;
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  /** Ulash (havola so'rovi) xatosi. */
  const [error, setError] = useState<string | null>(null);
  // Holat so'rovi yiqildi — skelet abadiy qolmaydi, ulash bloklanmaydi (audit PHASE 6, U3)
  const [statusError, setStatusError] = useState(false);
  const onChangeRef = useRef(onStatusChange);
  onChangeRef.current = onStatusChange;

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      const next = await fetchTelegramStatus(accessToken);
      setStatus(next);
      setStatusError(false);
      setError(null);
      onChangeRef.current?.(next);
    } catch {
      // Holat noma'lum — "bog'lanmagan" deb ko'rsatilmaydi
      setStatusError(true);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!showHint) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [showHint, refresh]);

  async function connect() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const { link } = await requestTelegramLink(accessToken);
      window.open(link, "_blank", "noopener");
      setShowHint(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  /** Server kodini joriy tildagi matnga aylantiradi (audit R3, api-errors-3). */
  function messageFor(err: unknown): string {
    if (!(err instanceof ApiError)) return t.profileHub.states.saveError;
    if (err.code === "TELEGRAM_UNAVAILABLE" || err.code === "BOT_OFFLINE" || err.status === 503) {
      return t.telegram.unavailable;
    }
    if (err.code === "USE_PHONE_CHANGE") return t.telegram.security.usePhoneChange;
    if (err.status === 429) return t.recovery.tooMany;
    // Holat yiqilganda ham ulash yoqiq — tarmoq uzilsa brauzerning xom "Failed to fetch" matni emas (audit PHASE 6, U3)
    return t.profileHub.states.saveError;
  }

  const allDone = Boolean(status?.linked && status?.phoneVerified);
  /** Maydon kelmasa "mavjud" deb hisoblanadi — eski API javobi UI'ni bloklamaydi. */
  const available = status?.available !== false;
  /** Faqat eng birinchi so'rov davomida (na natija, na xato kelgan) kutiladi. */
  const initialLoading = !status && !statusError;
  /** Holat hech qachon olinmadi — skelet o'rniga xato va qayta urinish. */
  const statusFailed = !status && statusError;
  /** Ulash xatosi yoki (holat avval olingan bo'lsa) yangilash xatosi. */
  const actionError = error ?? (statusError && status ? t.profileHub.states.loadError : null);

  const statusRows = statusFailed ? (
    <div role="alert" className="flex flex-col items-start gap-2.5">
      <p className="text-[13.5px] text-danger">{t.profileHub.states.loadError}</p>
      <Button variant="secondary" size="sm" onClick={() => void refresh()} loading={refreshing}>
        {!refreshing && <IconRefresh size={15} />}
        {t.telegram.refresh}
      </Button>
    </div>
  ) : (
    <ul className="flex flex-col gap-2">
      <StatusRow
        ok={Boolean(status?.phoneVerified)}
        loading={!status}
        text={
          status?.phoneVerified
            ? `${t.telegram.phoneVerified}${status.phone ? ` · ${status.phone}` : ""}`
            : t.telegram.phoneNotVerified
        }
      />
      <StatusRow ok={Boolean(status?.linked)} loading={!status} text={status?.linked ? t.telegram.linked : t.telegram.notLinked} />
    </ul>
  );

  /* ---------------- compact (dashboard) ---------------- */
  if (variant === "compact") {
    return (
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <TelegramTile size="sm" done={allDone} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] font-bold leading-tight text-ink">
              {allDone ? hub.connectedTitle : hub.title}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-dusk">{allDone ? hub.connectedHint : hub.compactHint}</p>
          </div>
        </div>
        <div className="mt-4">{statusRows}</div>
        {!allDone && !initialLoading && !available && (
          <p role="status" className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13px] text-ink">
            {t.telegram.unavailable}
          </p>
        )}
        {/* Holat olinmasa ham to'liq bo'limga o'tish mumkin (audit PHASE 6, U3) */}
        {!allDone && !initialLoading && openHref && (
          <a
            href={openHref}
            onClick={(e) => {
              if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onOpen();
            }}
            className="group mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-signal text-[13.5px] font-semibold text-white shadow-xs transition-all hover:bg-signal-dark active:scale-[0.98]"
          >
            <IconTelegram size={16} />
            {hub.open}
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </Card>
    );
  }

  /* ---------------- card / panel ---------------- */
  const isPanel = variant === "panel";
  return (
    <Card className={`relative overflow-hidden ${isPanel ? "p-5 sm:p-7" : "mt-8 p-6 sm:p-7"}`}>
      {isPanel && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_120%_at_100%_0%,rgb(34_158_217/0.10),transparent_65%)]"
        />
      )}

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
        <TelegramTile size={isPanel ? "lg" : "sm"} done={allDone} />
        <div className="min-w-0 flex-1">
          <h2 className={`font-display font-bold leading-tight tracking-tight text-ink ${isPanel ? "text-[20px]" : "text-lg"}`}>
            {isPanel ? (allDone ? hub.connectedTitle : hub.title) : t.telegram.title}
          </h2>
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-dusk">
            {isPanel ? (allDone ? hub.connectedHint : hub.subtitle) : t.telegram.subtitle}
          </p>

          <div className={`mt-5 grid gap-5 ${isPanel ? "md:grid-cols-2" : ""}`}>
            <div className="rounded-2xl border border-line bg-surface-2/50 p-4">{statusRows}</div>
            {isPanel && !allDone && (
              <ul className="flex flex-col gap-2.5">
                {hub.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink/85">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal">
                      <IconCheck size={12} />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!allDone && (
            <div className="mt-5">
              {!available && !initialLoading && (
                <p role="status" className="mb-3 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
                  {t.telegram.unavailable}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2.5">
                <Button onClick={connect} loading={busy} disabled={initialLoading || !available}>
                  {!busy && <IconTelegram size={17} />}
                  {busy ? t.telegram.connecting : t.telegram.connect}
                </Button>
                {showHint && !statusFailed && (
                  <Button variant="secondary" onClick={() => void refresh()} loading={refreshing}>
                    {!refreshing && <IconRefresh size={16} />}
                    {t.telegram.refresh}
                  </Button>
                )}
              </div>
              {showHint && (
                <p className="mt-3 animate-fade-in rounded-2xl bg-signal-soft px-4 py-3 text-[13.5px] leading-relaxed text-ink" role="status">
                  {t.telegram.hint}
                </p>
              )}
              {actionError && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {actionError}
                </p>
              )}
            </div>
          )}

          {/* Tasdiqlagandan so'ng amal boshlangan sahifaga qaytish (audit R3, candidate-flows-14) */}
          {allDone && <ReturnBackLink />}

          {/* Telefon xavfsizligi: asosiy raqam, raqamni almashtirish, zaxira raqam, Telegramni uzish.
              Hali hech narsa bog'lanmagan hisobda blok ko'rsatilmaydi — u yerda faqat ulash kerak. */}
          {status && !statusFailed && accessToken && (status.linked || status.phoneVerified) && (
            <PhoneSecurity
              status={status}
              token={accessToken}
              available={available}
              onChanged={() => void refresh()}
              // Deep-link ochilgach, foydalanuvchi Telegramdan qaytganda holat o'zi
              // yangilanadi — eski raqam ekranda qolib ketmaydi (audit R3, telegram-5)
              onDeepLink={() => setShowHint(true)}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

/** URL'dagi `returnTo` (faqat sayt ichidagi yo'l) bo'lsa qaytish havolasi. */
function ReturnBackLink() {
  const t = useT();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("returnTo");
    setHref(safeReturnTo(raw));
  }, []);

  if (!href) return null;
  return (
    <a
      href={href}
      className="group mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-signal transition-colors hover:text-signal-dark"
    >
      {t.telegram.returnBack}
      <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function StatusRow({ ok, loading, text }: { ok: boolean; loading: boolean; text: string }) {
  if (loading) {
    return (
      <li className="flex items-center gap-2.5" aria-hidden>
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3.5 w-40" />
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2.5 text-[13.5px]">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-growth text-white" : "border-2 border-dashed border-line"
        }`}
        aria-hidden
      >
        {ok && <IconCheck size={12} />}
      </span>
      <span className={ok ? "font-medium text-ink" : "text-dusk"}>{text}</span>
    </li>
  );
}

/** Telegram belgisi — brend ko'k plitkada; ulangach yashil tasdiq bilan. */
function TelegramTile({ size, done }: { size: "sm" | "lg"; done: boolean }) {
  const box = size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  return (
    <span className="relative shrink-0">
      <span className={`flex items-center justify-center bg-[#229ED9] text-white shadow-card ${box}`} aria-hidden>
        <IconTelegram size={size === "lg" ? 28 : 21} />
      </span>
      {done && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-growth text-white ring-2 ring-surface" aria-hidden>
          <IconCheck size={11} />
        </span>
      )}
    </span>
  );
}
