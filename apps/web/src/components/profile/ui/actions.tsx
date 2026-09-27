import React, { useEffect, useId, useState } from "react";
import { useT, useLocale } from "../../../lib/i18n/index.js";
import { apiErrorText } from "../../../lib/apiExtra.js";
import { IconAlert, IconCheck } from "../icons.js";


type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-signal text-white shadow-xs hover:bg-signal-dark",
  secondary: "border border-line bg-surface text-ink hover:border-signal/40 hover:text-signal",
  ghost: "text-dusk hover:bg-surface-2 hover:text-ink",
  danger: "text-danger hover:bg-danger/10",
};

/** Tugmalar, spinner va saqlash holati. */

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${
    size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-5 text-sm"
  } ${buttonVariants[variant]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-busy={loading || undefined}
      className={`${buttonClass(variant, size)} ${className}`}
      {...rest}
      disabled={rest.disabled || loading}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------- holatlar ---------------------------- */

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Saqlash holati. `aria-live` — ekran o'quvchi natijani e'lon qiladi. */
export function SaveStatus({ state, errorMessage }: { state: SaveState; errorMessage?: string | null }) {
  const t = useT();
  return (
    <span aria-live="polite" className="inline-flex min-h-[20px] items-center text-[13px] font-medium">
      {state === "saving" && (
        <span className="inline-flex items-center gap-1.5 text-dusk">
          <Spinner className="h-3.5 w-3.5" /> {t.profile.saving}
        </span>
      )}
      {state === "saved" && (
        <span className="inline-flex animate-fade-in items-center gap-1.5 text-growth">
          <IconCheck size={15} /> {t.profileHub.states.saved}
        </span>
      )}
      {state === "error" && (
        <span className="inline-flex animate-fade-in items-center gap-1.5 text-danger">
          <IconAlert size={15} /> {errorMessage || t.profileHub.states.saveError}
        </span>
      )}
    </span>
  );
}

/** "saved" holatini bir necha soniyadan keyin o'zi tozalaydi. */
export function useSaveState() {
  const { locale } = useLocale();
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (state !== "saved") return;
    const timer = window.setTimeout(() => setState("idle"), 2600);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    setState("saving");
    setError(null);
    try {
      const result = await task();
      setState("saved");
      return result;
    } catch (err) {
      // Audit R3, i18n-3: xom server matni (o'zbekcha) faqat uz interfeysda;
      // qolgan tillarda `SaveStatus` tarjima qilingan umumiy xabarni ko'rsatadi
      const text = apiErrorText(err, locale, { fallback: "" });
      setError(text && text !== "Xatolik" ? text : null);
      setState("error");
      return undefined;
    }
  }

  return { state, error, run, setState };
}
