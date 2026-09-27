import React, { useId } from "react";
import { useT } from "../../../../lib/i18n/index.js";
import { IconAlert, IconChevronDown } from "../icons.js";

/** Forma boshqaruvlari — bir xil balandlik (44px), fokus halqasi va xato holati. */
const CONTROL =
  "block w-full rounded-xl border bg-surface text-[14px] text-ink shadow-xs transition-colors placeholder:text-dusk/80 hover:border-signal/40 focus:outline-none focus:ring-4 disabled:opacity-60";
const tone = (invalid?: boolean) =>
  invalid ? "border-danger/60 focus:border-danger focus:ring-danger/10" : "border-line focus:border-signal focus:ring-signal/10";

/** `aria-describedby`: xato bo'lsa xato matni, aks holda yordamchi matn. */
export function describedBy(id: string, { error, hint }: { error?: string | null; hint?: string | null }) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function Field({
  id,
  label,
  required,
  optional,
  hint,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string | null;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const f = useT().vacancyForm;
  return (
    <div className={`min-w-0 ${className}`} data-field={id}>
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-1 text-[13.5px] font-medium text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden className="text-danger">
              *
            </span>
            <span className="sr-only">({f.required})</span>
          </>
        )}
        {optional && <span className="text-[13px] font-normal text-dusk">({f.optional})</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function FieldMessage({ id, error, hint }: { id: string; error?: string | null; hint?: string | null }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-danger">
        <IconAlert size={15} className="mt-px shrink-0" />
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-snug text-dusk">
      {hint}
    </p>
  ) : null;
}

export function TextInput({ invalid, suffix, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; suffix?: string }) {
  return (
    <div className="relative">
      <input
        {...props}
        aria-invalid={invalid || undefined}
        className={`${CONTROL} ${tone(invalid)} h-11 px-3.5 ${suffix ? "pr-14" : ""} ${className}`}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-dusk">{suffix}</span>}
    </div>
  );
}

export function TextArea({ invalid, className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...props} aria-invalid={invalid || undefined} className={`${CONTROL} ${tone(invalid)} min-h-[132px] resize-y px-3.5 py-3 leading-relaxed ${className}`} />;
}

export interface Option {
  value: string;
  label: string;
}

/** Oddiy `<select>` (klaviatura, ekran o'quvchi, telefon tanlagichi o'z-o'zidan ishlaydi). */
export function SelectInput({
  id,
  value,
  options,
  placeholder,
  placeholderSelectable = true,
  invalid,
  onChange,
  onBlur,
  ...aria
}: {
  id: string;
  value: string;
  options: Option[];
  placeholder?: string;
  /** Ixtiyoriy maydonda tanlovni bekor qilish mumkin; majburiyda — yo'q. */
  placeholderSelectable?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  "aria-describedby"?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
        aria-describedby={aria["aria-describedby"]}
        className={`${CONTROL} ${tone(invalid)} h-11 cursor-pointer appearance-none truncate pl-3.5 pr-10 dark:[color-scheme:dark] ${value ? "" : "text-dusk"}`}
      >
        {placeholder !== undefined && (
          <option value="" disabled={!placeholderSelectable}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-dusk" />
    </div>
  );
}

/** Belgilash katagi + izoh (butun karta bosiladi). */
export function CheckboxField({
  id,
  checked,
  onChange,
  label,
  hint,
  className = "",
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
        checked ? "border-signal/35 bg-signal-soft/50" : "border-line bg-surface hover:border-signal/30"
      } ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-line accent-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-ink">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="mt-0.5 block text-[12.5px] leading-snug text-dusk">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

/** Bo'lim kartasi: ikonka, sarlavha, tavsif va maydonlar. */
export function SectionCard({
  id,
  icon,
  title,
  subtitle,
  className = "",
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={`scroll-mt-28 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6 ${className}`}>
      <header className="flex items-start gap-3.5">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal dark:text-indigo-300">
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 id={headingId} className="font-display text-[17px] font-semibold leading-snug text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[13.5px] leading-snug text-dusk">{subtitle}</p>
        </div>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}
