import React from "react";
import { useLocale, useT } from "../../lib/i18n/index.js";
import type { ModerationEventView } from "../../lib/types.js";

/** Moderatsiya qarorlari (kim, qachon, nima, sabab) — vakansiya paneli va jurnal sahifasi uchun. */
export function ModerationHistory({ events, empty }: { events: ModerationEventView[]; empty: string }) {
  const t = useT();
  const { locale } = useLocale();
  const lg = t.admin.log;
  if (events.length === 0) return <p className="text-sm text-dusk">{empty}</p>;
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex gap-2.5 text-xs">
          <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.actorId ? "bg-signal" : "bg-gold"}`} />
          <div className="min-w-0">
            <p className="text-ink">
              <span className="font-semibold">{lg.actions[e.action] ?? e.action}</span>
              <span className="text-dusk"> · {e.actorId ? (e.actorName ?? "—") : lg.system}</span>
            </p>
            {e.reason && <p className="mt-0.5 whitespace-pre-wrap text-dusk">↳ {e.reason}</p>}
            <p className="text-dusk">{new Date(e.createdAt).toLocaleString(locale)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
