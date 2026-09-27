import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { ApiError } from "../../lib/api.js";
import { AuthField, AuthSubmit, AuthError, PasswordField, MailIcon, UserIcon } from "../AuthForm.js";
import {
  checkResetToken,
  manualRecoveryContinue,
  manualRecoveryStatus,
  minutesUntil,
  recoveryErrorKind,
  resetPassword,
  startPhoneRecovery,
  submitManualRecovery,
  type ManualRecoveryStatus,
  type RecoveryMode,
} from "../../lib/auth/recovery.js";
import type { TelegramLink } from "../../lib/types.js";

/**
 * Parolni tiklash UI — `/login` sahifasining query rejimlari (audit R3, D-045, D-049, D-063).
 * Yangi sahifa yaratilmaydi: `?recover=1`, `?recover=manual`, `?recover=status`, `?reset=<token>`.
 *
 * Har rejimda yuklanish, xato va muvaffaqiyat holatlari alohida: API xatosi hech qachon
 * bo'sh holat yoki soxta muvaffaqiyat bo'lib ko'rinmaydi.
 */
export function RecoveryPanel({
  mode,
  resetToken,
}: {
  mode: Exclude<RecoveryMode, null>;
  resetToken: string;
}) {
  const t = useT();
  const l = useHref();

  return (
    <div>
      <a
        href={l("/login")}
        className="group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-signal transition-colors hover:text-signal-dark"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        {t.recovery.back}
      </a>

      <div className="mt-3">
        {mode === "phone" && <PhoneMode />}
        {mode === "manual" && <ManualMode />}
        {mode === "status" && <StatusMode />}
        {mode === "reset" && <ResetMode token={resetToken} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Umumiy qismlar
 * ------------------------------------------------------------------ */

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[1.8rem]">
        {title}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-dusk">{subtitle}</p>
    </div>
  );
}

/** Xato matnini kod bo'yicha tanlaydi — server matni uch tilga tarjima qilinmaydi. */
function useErrorText() {
  const t = useT();
  return useCallback(
    (err: unknown, invalidText?: string) => {
      switch (recoveryErrorKind(err)) {
        case "unavailable":
          return t.recovery.unavailable;
        case "rateLimit":
          return t.recovery.tooMany;
        case "notApproved":
          return t.recovery.notApproved;
        case "invalidPhone":
          return invalidText ?? t.recovery.genericError;
        default:
          return t.recovery.genericError;
      }
    },
    [t]
  );
}

/** Telegram deep-link kartasi: havola, muddat va qaytadan boshlash. */
function LinkCard({ link, onRestart }: { link: TelegramLink; onRestart: () => void }) {
  const t = useT();
  const minutes = minutesUntil(link.expiresAt);
  return (
    <div className="mt-4 rounded-2xl border border-line bg-signal-soft p-4" role="status">
      <p className="text-[14px] font-semibold text-ink">{t.recovery.linkTitle}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink/80">{t.recovery.linkHint}</p>
      <a
        href={link.link}
        target="_blank"
        rel="noopener noreferrer"
        className="glow-signal mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-bold text-white transition-colors hover:bg-signal-dark"
      >
        <TelegramGlyph />
        {t.recovery.openTelegram}
      </a>
      {minutes !== null && <p className="mt-2 text-[12.5px] text-ink/70">{t.recovery.expiresIn(minutes)}</p>}
      <button
        type="button"
        onClick={onRestart}
        className="mt-3 block text-[13px] font-semibold text-signal transition-colors hover:text-signal-dark"
      >
        {t.recovery.restart}
      </button>
    </div>
  );
}

function TelegramGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M5.4 11.9l14-5.4c.65-.25 1.2.16.99 1.15l-2.38 11.2c-.17.78-.64.97-1.3.6l-3.6-2.65-1.74 1.68c-.19.19-.36.36-.73.36l.26-3.7 6.73-6.08c.29-.26-.07-.4-.45-.15l-8.3 5.23-3.58-1.12c-.78-.24-.79-.78.1-1.12z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 1 — telefon raqami orqali tiklash (?recover=1)
 * ------------------------------------------------------------------ */

function PhoneMode() {
  const t = useT();
  const l = useHref();
  const errorText = useErrorText();
  const errorId = useId();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setLink(await startPhoneRecovery(phone));
    } catch (err) {
      setError(errorText(err, t.recovery.phoneInvalid));
      phoneRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Heading title={t.recovery.title} subtitle={t.recovery.subtitle} />

      {link ? (
        <LinkCard link={link} onRestart={() => setLink(null)} />
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <AuthField
            label={t.recovery.phoneLabel}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={setPhone}
            placeholder={t.recovery.phonePlaceholder}
            autoComplete="tel"
            required
            icon={<PhoneGlyph />}
            hint={t.recovery.phoneHint}
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
            inputRef={phoneRef}
          />
          {error && <AuthError id={errorId}>{error}</AuthError>}
          <AuthSubmit loading={loading} label={t.recovery.submit} loadingLabel={t.recovery.submitting} />
        </form>
      )}

      <p className="mt-5 border-t border-line pt-4 text-[13.5px] text-dusk">
        {t.recovery.manualLink}{" "}
        <a
          href={l("/login?recover=manual")}
          className="font-semibold text-signal transition-colors hover:text-signal-dark"
        >
          {t.recovery.manualTitle}
        </a>
      </p>
    </div>
  );
}

function PhoneGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.2 3.5h3l1.5 3.7-2 1.4a12 12 0 0 0 5.7 5.7l1.4-2 3.7 1.5v3a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 4.4 5.5a1.8 1.8 0 0 1 1.8-2Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 2 — qo'lda tiklash so'rovi (?recover=manual)
 * ------------------------------------------------------------------ */

function ManualMode() {
  const t = useT();
  const l = useHref();
  const errorText = useErrorText();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const detailsId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await submitManualRecovery({
        email: email.trim(),
        fullName: fullName.trim(),
        details: details.trim(),
        ...(contact.trim() ? { contact: contact.trim() } : {}),
      });
      setCode(res.requestCode);
    } catch (err) {
      setError(errorText(err));
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  if (code) return <ManualDone code={code} />;

  return (
    <div>
      <Heading title={t.recovery.manualTitle} subtitle={t.recovery.manualHint} />

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <AuthField
          label={t.recovery.manualEmail}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ism@email.com"
          autoComplete="email"
          required
          icon={<MailIcon />}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          inputRef={emailRef}
        />
        <AuthField
          label={t.recovery.manualFullName}
          value={fullName}
          onChange={setFullName}
          placeholder={t.recovery.manualFullNamePlaceholder}
          autoComplete="name"
          required
          icon={<UserIcon />}
        />

        <div>
          <label htmlFor={detailsId} className="block text-[13px] font-semibold leading-tight text-ink">
            {t.recovery.manualDetails}
          </label>
          <textarea
            id={detailsId}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            required
            rows={4}
            // Server chegarasi: 10–1000 belgi (audit R3, D-049) — mos kelmasa umumiy 400 xatosi chiqardi
            minLength={10}
            maxLength={1000}
            aria-describedby={`${detailsId}-hint`}
            className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-dusk focus:border-signal focus:bg-surface focus:outline-none"
          />
          <p id={`${detailsId}-hint`} className="mt-1 text-[12.5px] leading-relaxed text-dusk">
            {t.recovery.manualDetailsHint}
          </p>
        </div>

        <AuthField
          label={t.recovery.manualContact}
          value={contact}
          onChange={setContact}
          icon={<UserIcon />}
          hint={t.recovery.manualContactHint}
        />

        {error && <AuthError id={errorId}>{error}</AuthError>}
        <AuthSubmit loading={loading} label={t.recovery.manualSubmit} loadingLabel={t.recovery.manualSubmitting} />
      </form>

      <p className="mt-5 border-t border-line pt-4 text-[13.5px] text-dusk">
        <a
          href={l("/login?recover=status")}
          className="font-semibold text-signal transition-colors hover:text-signal-dark"
        >
          {t.recovery.toStatus}
        </a>
      </p>
    </div>
  );
}

/** So'rov kodi bir marta ko'rsatiladi — nusxa olish tugmasi bilan. */
function ManualDone({ code }: { code: string }) {
  const t = useT();
  const l = useHref();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-ink focus:outline-none sm:text-[1.8rem]"
      >
        {t.recovery.manualDoneTitle}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-dusk">{t.recovery.manualDoneHint}</p>

      <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-dusk">{t.recovery.codeLabel}</p>
        <p className="mt-1.5 select-all break-all font-mono text-[18px] font-bold text-ink">{code}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
          >
            {t.recovery.copy}
          </button>
          <span aria-live="polite" className="text-[13px] font-medium text-growth">
            {copied ? t.recovery.copied : ""}
          </span>
        </div>
        {copyError && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {t.recovery.copyFailed}
          </p>
        )}
      </div>

      <a
        href={l("/login?recover=status")}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-signal px-5 text-sm font-bold text-white transition-colors hover:bg-signal-dark"
      >
        {t.recovery.toStatus}
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 3 — so'rov holati va davom ettirish (?recover=status)
 * ------------------------------------------------------------------ */

function StatusMode() {
  const t = useT();
  const errorText = useErrorText();
  const errorId = useId();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ManualRecoveryStatus | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setLink(null);
    setLoading(true);
    try {
      const res = await manualRecoveryStatus(code.trim());
      setStatus(res.status);
    } catch (err) {
      // Server kod formatini 400 bilan rad etadi — bu «kod topilmadi» degani (audit R3, D-049)
      setError(errorText(err, t.recovery.statusValue.not_found));
      codeRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function proceed() {
    setError(null);
    setContinuing(true);
    try {
      setLink(await manualRecoveryContinue(code.trim()));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setContinuing(false);
    }
  }

  return (
    <div>
      <Heading title={t.recovery.statusTitle} subtitle={t.recovery.statusHint} />

      <form onSubmit={check} className="mt-4 flex flex-col gap-3">
        <AuthField
          label={t.recovery.statusCodeLabel}
          value={code}
          onChange={setCode}
          placeholder={t.recovery.statusCodePlaceholder}
          required
          icon={<KeyGlyph />}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          inputRef={codeRef}
        />
        {error && <AuthError id={errorId}>{error}</AuthError>}
        <AuthSubmit loading={loading} label={t.recovery.statusCheck} loadingLabel={t.recovery.statusChecking} />
      </form>

      {status && !link && (
        <div
          role="status"
          className={`mt-4 rounded-2xl border p-4 text-[13.5px] leading-relaxed ${
            status === "approved"
              ? "border-growth/30 bg-growth/10 text-ink"
              : status === "rejected" || status === "expired" || status === "not_found"
                ? "border-danger/30 bg-danger/10 text-ink"
                : "border-line bg-surface-2 text-ink"
          }`}
        >
          <p>{t.recovery.statusValue[status]}</p>
          {status === "approved" && (
            <button
              type="button"
              onClick={() => void proceed()}
              disabled={continuing}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-bold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
            >
              <TelegramGlyph />
              {continuing ? t.recovery.submitting : t.recovery.continueTelegram}
            </button>
          )}
        </div>
      )}

      {link && <LinkCard link={link} onRestart={() => setLink(null)} />}
    </div>
  );
}

function KeyGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15.5 12v2.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 4 — yangi parol (?reset=<token>)
 * ------------------------------------------------------------------ */

type ResetPhase = "checking" | "invalid" | "checkFailed" | "form" | "done";

function ResetMode({ token }: { token: string }) {
  const t = useT();
  const l = useHref();
  const errorText = useErrorText();
  const errorId = useId();
  const [phase, setPhase] = useState<ResetPhase>(token ? "checking" : "invalid");
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // Token manzil qatorida qolmaydi: tarix, referrer va ekran ulashishda ko'rinmasin (audit R3, D-045)
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.search) return;
    // Vike router holati (scroll va h.k.) saqlanadi — faqat query olib tashlanadi
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setPhase("checking");
    checkResetToken(token).then(
      (res) => {
        if (alive) setPhase(res.valid ? "form" : "invalid");
      },
      (err: unknown) => {
        // Tarmoq yoki server xatosi "havola yaroqsiz" bo'lib ko'rinmaydi: faqat 400
        // (format xato) tokenning o'zi haqida gapiradi, qolgani — qayta urinsa bo'ladigan xato.
        if (alive) setPhase(err instanceof ApiError && err.status === 400 ? "invalid" : "checkFailed");
      }
    );
    return () => {
      alive = false;
    };
  }, [token, attempt]);

  useEffect(() => {
    if (phase === "done") doneRef.current?.focus();
  }, [phase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t.recovery.tooShort);
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setError(t.recovery.mismatch);
      confirmRef.current?.focus();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      setPhase("done");
    } catch (err) {
      // Token endi yaroqsiz bo'lsa — alohida holat, soxta muvaffaqiyat emas
      const code = (err as { code?: string })?.code;
      if (code === "RESET_TOKEN_INVALID") setPhase("invalid");
      else if (code === "WEAK_PASSWORD") {
        // Server parol siyosati (400): sabab ko'rsatiladi, umumiy xato emas
        setError(t.recovery.weakPassword);
        passwordRef.current?.focus();
      } else setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="py-6" aria-busy="true">
        <p className="text-[14px] text-dusk" role="status">
          {t.recovery.checking}
        </p>
        <div className="mt-3 h-11 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (phase === "checkFailed") {
    return (
      <div role="alert">
        <Heading title={t.recovery.genericError} subtitle={t.recovery.checkError} />
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-signal px-5 text-sm font-bold text-white transition-colors hover:bg-signal-dark"
        >
          {t.error.retry}
        </button>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div role="alert">
        <Heading title={t.recovery.tokenInvalidTitle} subtitle={t.recovery.tokenInvalidText} />
        <a
          href={l("/login?recover=1")}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-signal px-5 text-sm font-bold text-white transition-colors hover:bg-signal-dark"
        >
          {t.recovery.restart}
        </a>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div>
        <h1
          ref={doneRef}
          tabIndex={-1}
          className="font-display text-[1.6rem] font-extrabold leading-tight tracking-tight text-ink focus:outline-none sm:text-[1.8rem]"
        >
          {t.recovery.successTitle}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-dusk">{t.recovery.successText}</p>
        <a
          href={l("/login")}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-signal px-5 text-sm font-bold text-white transition-colors hover:bg-signal-dark"
        >
          {t.recovery.toLogin}
        </a>
      </div>
    );
  }

  return (
    <div>
      <Heading title={t.recovery.resetTitle} subtitle={t.recovery.resetHint} />
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <PasswordField
          label={t.recovery.newPassword}
          value={password}
          onChange={setPassword}
          placeholder={t.recovery.newPasswordPlaceholder}
          autoComplete="new-password"
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          inputRef={passwordRef}
        />
        <PasswordField
          label={t.recovery.confirmPassword}
          value={confirm}
          onChange={setConfirm}
          placeholder={t.recovery.confirmPlaceholder}
          autoComplete="new-password"
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          inputRef={confirmRef}
        />
        {error && <AuthError id={errorId}>{error}</AuthError>}
        <AuthSubmit loading={loading} label={t.recovery.resetSubmit} loadingLabel={t.recovery.resetSubmitting} />
      </form>
    </div>
  );
}
