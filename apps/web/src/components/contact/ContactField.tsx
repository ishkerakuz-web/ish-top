import React from "react";
import { IconAlert } from "../support/icons.js";

/** Maydon uslubi — xato bo'lsa qizil chegara (rang yagona belgi emas: ostida matn ham bor). */
export function fieldClass(invalid: boolean): string {
  return `w-full rounded-xl border bg-surface-2 px-3.5 text-[14.5px] text-ink transition-colors placeholder:text-dusk/80 focus:bg-surface focus:outline-none focus:ring-4 ${
    invalid ? "border-danger focus:border-danger focus:ring-danger/10" : "border-line hover:border-signal/40 focus:border-signal focus:ring-signal/10"
  }`;
}

export const errorId = (id: string) => `${id}-error`;

/**
 * Yorliq + boshqaruv + xato matni. Boshqaruv (input/select/textarea) chaqiruvchida:
 * u `aria-invalid` va `aria-describedby={errorId(id)}` oladi — xato maydonga bog'langan.
 */
export function ContactField({
  id,
  label,
  required = false,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13.5px] font-semibold text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={errorId(id)} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-danger">
          <IconAlert size={15} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
