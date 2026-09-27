import React, { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";

/**
 * Joriy parol bilan tasdiqlash (audit R3, D-047, D-048): telefonni almashtirish,
 * zaxira raqam qo'shish/olib tashlash va Telegramni uzish shu forma orqali o'tadi.
 *
 * Inline forma — modal emas: fokus ochilganda maydonga ko'chadi, Escape bekor qiladi,
 * xato `role="alert"` bilan e'lon qilinadi va maydonga `aria-describedby` bilan bog'lanadi.
 */
export function PasswordPrompt({
  title,
  description,
  submitLabel,
  busy = false,
  error,
  onSubmit,
  onCancel,
}: {
  title: string;
  description?: string;
  submitLabel?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const s = t.telegram.security;
  const id = useId();
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && password) onSubmit(password);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="mt-3 rounded-2xl border border-line bg-surface-2/60 p-4"
    >
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-dusk">{description}</p>}

      <label htmlFor={id} className="mt-3 block text-[13px] font-semibold text-ink">
        {s.passwordLabel}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={s.passwordPlaceholder}
        autoComplete="current-password"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1 h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink transition-colors placeholder:text-dusk focus:outline-none ${
          error ? "border-danger focus:border-danger" : "border-line focus:border-signal"
        }`}
      />

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2.5">
        <button
          type="submit"
          disabled={busy || !password}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-signal px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel ?? s.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
        >
          {s.cancel}
        </button>
      </div>
    </form>
  );
}
