import React, { useEffect, useId, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { IconAlert } from "../icons.js";
import { inputBase } from "./layout.js";


/** Forma elementlari: maydon, matn kiritish, o'chirgich va fokus yordamchisi. */

export function inputClass(invalid = false) {
  return `${inputBase} ${
    invalid ? "border-danger focus:border-danger focus:ring-danger/10" : "border-line focus:border-signal focus:ring-signal/10"
  }`;
}

/**
 * Yorliq + maydon + izoh/xato. `children` ga `id` beriladi (render-prop orqali).
 *
 * Audit R3, gap5-2: majburiy maydon ekran o'quvchiga ham aytiladi (yulduzcha
 * yoniga sr-only matn, maydonga `aria-required`), xato `role="alert"` bilan
 * e'lon qilinadi va `aria-describedby` faqat haqiqatan chizilgan elementga
 * ishora qiladi (xato izohni almashtirgach osilib qolgan id qolmaydi).
 */
export function Field({
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean; required: boolean }) => React.ReactNode;
}) {
  const t = useT();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        {label}
        {required && (
          <>
            <span className="text-danger" aria-hidden>
              *
            </span>
            <span className="sr-only">({t.profileHub.states.required})</span>
          </>
        )}
      </label>
      <div className="mt-1.5">{children({ id, describedBy, invalid: Boolean(error), required: Boolean(required) })}</div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <IconAlert size={13} /> {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-dusk">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Tekshiruvdan o'tmagan birinchi maydonga fokus (audit R3, gap5-2). Xato
 * matnlari `role="alert"` bilan chizilgandan keyin chaqiriladi, shuning uchun
 * keyingi kadrda ishlaydi. Forma topilmasa hech narsa qilmaydi.
 */
export function focusFirstInvalid(form: HTMLElement | null | undefined): void {
  if (!form || typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const target = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  });
}

export function TextInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  required,
  className = "",
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Faqat `aria-required` — brauzerning o'z tekshiruv oynachasi chiqmasin. */
  required?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "required">) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-required={required || undefined}
      aria-describedby={describedBy}
      className={`h-11 px-3.5 ${inputClass(invalid)} ${className}`}
      {...rest}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  required,
  rows = 4,
  maxLength,
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "required">) {
  return (
    <div className="relative">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        className={`resize-y px-3.5 py-2.5 leading-relaxed ${inputClass(invalid)}`}
        {...rest}
      />
      {maxLength && (
        <span className="pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] tabular-nums text-dusk/80" aria-hidden>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

/** Kirish tugmasi: `role="switch"` — ekran o'quvchi holatni "yoqilgan/o'chirilgan" deb o'qiydi. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={hint ? `${id}-hint` : undefined}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/60 px-4 py-3.5 text-left transition-colors hover:border-signal/30"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="mt-0.5 block text-xs text-dusk">
            {hint}
          </span>
        )}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-signal" : "bg-line"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/* ---------------------------- tugmalar ---------------------------- */

