import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconAlert, IconBriefcase, IconRefresh, Spinner } from "./icons.js";

function StatePanel({
  icon,
  title,
  text,
  action,
  tone = "neutral",
  role,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
  tone?: "neutral" | "danger";
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          tone === "danger" ? "bg-danger/10 text-danger" : "bg-signal-soft text-signal"
        }`}
      >
        {icon}
      </span>
      <p className="mt-5 max-w-md font-display text-lg font-bold text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-dusk">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const primaryBtn =
  "inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export function VacancyEmptyState({ onReset, canReset }: { onReset: () => void; canReset: boolean }) {
  const s = useT().vacanciesPage.states;
  return (
    <StatePanel
      role="status"
      icon={<IconBriefcase size={26} />}
      title={s.emptyTitle}
      text={s.emptyText}
      action={
        canReset ? (
          <button type="button" onClick={onReset} className={primaryBtn}>
            {s.reset}
          </button>
        ) : undefined
      }
    />
  );
}

export function VacancyErrorState({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const s = useT().vacanciesPage.states;
  return (
    <StatePanel
      role="alert"
      tone="danger"
      icon={<IconAlert size={26} />}
      title={s.errorTitle}
      text={s.errorText}
      action={
        <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined} className={primaryBtn}>
          {retrying ? <Spinner size={16} /> : <IconRefresh size={16} />}
          {s.retry}
        </button>
      }
    />
  );
}
