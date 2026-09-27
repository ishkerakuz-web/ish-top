import React, { useEffect, useId, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { ApplicationStatus } from "../../../lib/types.js";
import { IconAlert, IconRefresh } from "../icons.js";
import { Button } from "./actions.js";

/** Bo'sh holat, xato holati va ariza belgisi. */


/** Bo'sh holat, xato holati va ariza belgisi. */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface-2/40 text-center ${
        compact ? "px-5 py-7" : "px-6 py-10"
      }`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-signal shadow-xs ring-1 ring-line">
        {icon}
      </span>
      <p className="mt-3.5 font-display text-[15px] font-bold text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-dusk">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  const t = useT();
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-2xl border border-danger/20 bg-danger/5 text-center ${
        compact ? "px-5 py-6" : "px-6 py-10"
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <IconAlert size={20} />
      </span>
      <p className="mt-3 font-display text-[15px] font-bold text-ink">{t.profileHub.states.loadError}</p>
      <p className="mt-1 text-[13.5px] text-dusk">{t.profileHub.states.loadErrorHint}</p>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        <IconRefresh size={15} /> {t.profileHub.states.retry}
      </Button>
    </div>
  );
}

/* ---------------------------- vizual ---------------------------- */

const STATUS_STYLE: Record<ApplicationStatus, { box: string; dot: string }> = {
  sent: { box: "bg-surface-2 text-dusk", dot: "bg-dusk/60" },
  viewed: { box: "bg-signal-soft text-signal", dot: "bg-signal" },
  invited: { box: "bg-gold/15 text-gold-deep", dot: "bg-gold" },
  accepted: { box: "bg-growth/10 text-growth", dot: "bg-growth" },
  rejected: { box: "bg-danger/10 text-danger", dot: "bg-danger" },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const t = useT();
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.sent;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style.box}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {t.profileHub.applications.status[status]}
    </span>
  );
}

/** Logotip bo'lmasa — nomning bosh harfi, nomga bog'liq barqaror rang bilan. */
