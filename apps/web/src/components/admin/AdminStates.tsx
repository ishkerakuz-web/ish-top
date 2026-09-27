import React from "react";
import { IconAlert, IconRefresh, Spinner } from "./icons.js";

export const ADMIN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-signal px-4 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
export const ADMIN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
export const ADMIN_CARD = "rounded-2xl border border-line bg-surface p-5 shadow-card";
export const ADMIN_INPUT =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-dusk transition-colors focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-dusk dark:[color-scheme:dark]";
export const ADMIN_LABEL = "block text-[13px] font-semibold text-ink";

/** Bo'sh holat (belgisi va matni bilan). */
export function AdminEmpty({ icon, title, text, children, testId }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-soft text-signal dark:text-indigo-300">{icon}</span>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-dusk">{text}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

/** Yuklab bo'lmadi — haqiqiy qayta so'rov tugmasi bilan. */
export function AdminError({ title, text, retry, onRetry, retrying = false, testId }: { title: string; text: string; retry: string; onRetry: () => void; retrying?: boolean; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-col items-center rounded-2xl border border-dashed border-danger/30 bg-surface px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <IconAlert size={22} />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-dusk">{text}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className={`${ADMIN_PRIMARY} mt-5`}>
        {retrying ? <Spinner size={15} /> : <IconRefresh size={15} />}
        {retry}
      </button>
    </div>
  );
}

/** Qisqa natija xabari (saqlandi / xatolik) — ekran o'quvchiga e'lon qilinadi. */
export function AdminNotice({ notice }: { notice: { tone: "success" | "error"; text: string } | null }) {
  return (
    <div aria-live="polite" className="min-h-0">
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          data-testid="admin-notice"
          data-tone={notice.tone}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${
            notice.tone === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-growth/30 bg-growth/10 text-growth"
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
