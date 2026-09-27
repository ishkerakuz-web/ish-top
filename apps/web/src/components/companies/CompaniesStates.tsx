import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconAlert, IconBuilding, IconHeart, IconRefresh, Spinner } from "./icons.js";

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
      <p className="mt-5 font-display text-lg font-bold text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-dusk">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const primaryBtn =
  "inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export function CompaniesEmptyState({ onReset }: { onReset: () => void }) {
  const s = useT().companiesPage.states;
  return (
    <StatePanel
      role="status"
      icon={<IconBuilding size={26} />}
      title={s.emptyTitle}
      text={s.emptyText}
      action={
        <button type="button" onClick={onReset} className={primaryBtn}>
          {s.emptyCta}
        </button>
      }
    />
  );
}

export function SavedEmptyState() {
  const s = useT().companiesPage.states;
  return <StatePanel role="status" icon={<IconHeart size={26} />} title={s.savedEmptyTitle} text={s.savedEmptyText} />;
}

export function SavedLoginState({ loginHref }: { loginHref: string }) {
  const s = useT().companiesPage.states;
  return (
    <StatePanel
      icon={<IconHeart size={26} />}
      title={s.savedLoginTitle}
      text={s.savedLoginText}
      action={
        <a href={loginHref} className={primaryBtn}>
          {s.savedLoginCta}
        </a>
      }
    />
  );
}

export function CompaniesErrorState({ onRetry }: { onRetry: () => void }) {
  const s = useT().companiesPage.states;
  return (
    <StatePanel
      role="alert"
      tone="danger"
      icon={<IconAlert size={26} />}
      title={s.errorTitle}
      text={s.errorText}
      action={
        <button type="button" onClick={onRetry} className={primaryBtn}>
          <IconRefresh size={16} />
          {s.retry}
        </button>
      }
    />
  );
}

/** Ro'yxat oxiridagi holat: yuklanmoqda / xato / hammasi ko'rildi. */
export function InfiniteCompanyLoader({ status, onRetry }: { status: "loading" | "error" | "done"; onRetry: () => void }) {
  const s = useT().companiesPage.states;
  if (status === "done") {
    return (
      <p className="flex items-center justify-center gap-3 py-2 text-sm text-dusk">
        <span className="h-px w-10 bg-line" aria-hidden />
        {s.end}
        <span className="h-px w-10 bg-line" aria-hidden />
      </p>
    );
  }
  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-sm sm:flex-row">
        <span className="inline-flex items-center gap-2 font-medium text-danger">
          <IconAlert size={18} />
          {s.loadMoreError}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
        >
          <IconRefresh size={15} />
          {s.retry}
        </button>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
      <Spinner size={20} className="text-signal" />
      <span className="text-sm font-medium text-ink">{s.loadingMore}</span>
    </div>
  );
}
