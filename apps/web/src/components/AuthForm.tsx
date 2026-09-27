import React, { useId, useState } from "react";
import { useT, useHref } from "../lib/i18n/index.js";

/* ------------------------------------------------------------------ *
 * Kirish / ro'yxatdan o'tish formalarining umumiy qismlari.
 * ------------------------------------------------------------------ */

/** Ikki sahifa orasidagi almashtirgich. Havola — SSR'da ham to'g'ri ishlaydi. */
export function AuthTabs({ active }: { active: "login" | "signup" }) {
  const t = useT();
  const l = useHref();
  const tabs = [
    { key: "login" as const, href: "/login", label: t.login.tabLogin, icon: <UserIcon /> },
    { key: "signup" as const, href: "/signup", label: t.login.tabSignup, icon: <UserPlusIcon /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface-2 p-1">
      {tabs.map((tab) =>
        tab.key === active ? (
          <span
            key={tab.key}
            aria-current="page"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-signal px-2 py-2 text-[13px] font-bold text-white shadow-xs sm:gap-2 sm:px-3 sm:text-sm"
          >
            <span className="shrink-0">{tab.icon}</span>
            <span className="whitespace-nowrap">{tab.label}</span>
          </span>
        ) : (
          <a
            key={tab.key}
            href={l(tab.href)}
            className="flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-semibold text-dusk transition-colors hover:text-ink sm:gap-2 sm:px-3 sm:text-sm"
          >
            <span className="shrink-0">{tab.icon}</span>
            <span className="whitespace-nowrap">{tab.label}</span>
          </a>
        )
      )}
    </div>
  );
}

/**
 * Chap tomonida ikonkasi bo'lgan matn maydoni.
 *
 * `invalid` va `describedBy` — xato bilan bog'lash uchun (audit R3, a11y-ui-3):
 * `aria-invalid` va `aria-describedby` DESIGN.md konvensiyasiga mos qo'yiladi.
 * `inputRef` — xatodan keyin fokusni birinchi noto'g'ri maydonga ko'chirish uchun.
 */
export function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  icon,
  invalid = false,
  describedBy,
  hint,
  inputMode,
  inputRef,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  icon: React.ReactNode;
  invalid?: boolean;
  describedBy?: string;
  hint?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const described = [hint ? hintId : null, describedBy ?? null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold leading-tight text-ink">
        {label}
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk">
          {icon}
        </span>
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={invalid || undefined}
          aria-describedby={described || undefined}
          className={`h-11 w-full rounded-xl border bg-surface-2 pl-11 pr-3.5 text-sm text-ink transition-colors placeholder:text-dusk focus:bg-surface focus:outline-none ${
            invalid ? "border-danger focus:border-danger" : "border-line focus:border-signal"
          }`}
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-[12.5px] leading-relaxed text-dusk">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Parol maydoni — ko'rsatish/yashirish tugmasi bilan. */
export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid = false,
  describedBy,
  hint,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
  hint?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const t = useT();
  const id = useId();
  const hintId = `${id}-hint`;
  const described = [hint ? hintId : null, describedBy ?? null].filter(Boolean).join(" ");
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold leading-tight text-ink">
        {label}
      </label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dusk">
          <LockIcon />
        </span>
        <input
          id={id}
          ref={inputRef}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={described || undefined}
          className={`h-11 w-full rounded-xl border bg-surface-2 pl-11 pr-12 text-sm text-ink transition-colors placeholder:text-dusk focus:bg-surface focus:outline-none ${
            invalid ? "border-danger focus:border-danger" : "border-line focus:border-signal"
          }`}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t.login.hidePassword : t.login.showPassword}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-[12.5px] leading-relaxed text-dusk">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Forma xatosi — `role="alert"` bilan e'lon qilinadi va maydonlarga
 * `aria-describedby` orqali bog'lanadi (audit R3, a11y-ui-3).
 */
export function AuthError({ id, children }: { id: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <p
      id={id}
      role="alert"
      data-testid="auth-error"
      className="animate-fade-in rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <span className="sr-only">{t.login.errorLabel}: </span>
      {children}
    </p>
  );
}

/** Formaning asosiy tugmasi — o'ngga siljiydigan strelka bilan. */
export function AuthSubmit({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="glow-signal group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-signal text-sm font-bold text-white hover:bg-signal-dark active:scale-[0.99] disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
      {!loading && (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}

/** "yoki" ajratgichi. */
export function AuthDivider() {
  const t = useT();
  return (
    <div className="my-3.5 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-medium text-dusk">{t.login.orDivider}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ---------------------------- ikonkalar ---------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5l7.4 5.2a2 2 0 0 0 2.2 0l7.4-5.2" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}>
      <circle cx="10" cy="8" r="3.6" />
      <path d="M3.4 20a6.6 6.6 0 0 1 13.2 0M18.5 7.5v5M21 10h-5" />
    </svg>
  );
}

export function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 20.5h16M6.5 20.5v-13A1.5 1.5 0 0 1 8 6h5a1.5 1.5 0 0 1 1.5 1.5v13M17.5 20.5V11h-3" />
      <path d="M9 9.5h2.5M9 12.5h2.5M9 15.5h2.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-3 3.8M6.4 7.3A17 17 0 0 0 2.5 11.2S6 17.4 12 17.4a9.4 9.4 0 0 0 3.5-.66" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4M3.5 3.5l17 17" />
    </svg>
  );
}
