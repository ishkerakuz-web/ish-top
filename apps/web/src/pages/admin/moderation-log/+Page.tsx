import React, { useState } from "react";
import { AdminShell, AdminFilters, AdminSelect, AdminTable, Pager } from "../../../components/AdminShell.js";
import { AdminError } from "../../../components/admin/AdminStates.js";
import { useT, useLocale } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { fetchModerationLog } from "../../../lib/apiExtra.js";
import { canModerate } from "../../../lib/admin/roles.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import type { ModerationEventView } from "../../../lib/types.js";

/** Moderatsiya jurnali: kim, qachon, qaysi yozuv bo'yicha qanday qaror qildi (avto-tasdiq ham). */
export default function Page() {
  return (
    <AdminShell allow="moderation">
      <ModerationLog />
    </AdminShell>
  );
}

function ModerationLog() {
  const t = useT();
  const lg = t.admin.log;
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [entityType, setEntityType] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);

  const token = status === "authed" && canModerate(user?.role) ? accessToken : null;
  const { state, pending, reload } = useAdminResource(
    token ? (signal) => fetchModerationLog(token, { entityType, actor, page }, signal) : null,
    JSON.stringify({ entityType, actor, page })
  );
  const data = state.kind === "ready" ? state.data : null;

  return (
    <div>
      <AdminFilters>
        <AdminSelect
          label={lg.entityLabel}
          value={entityType}
          onChange={(v) => {
            setPage(1);
            setEntityType(v);
          }}
          options={[
            { value: "", label: lg.allEntities },
            { value: "vacancy", label: lg.entities.vacancy },
            { value: "review", label: lg.entities.review },
            { value: "company", label: lg.entities.company },
            { value: "ticket", label: lg.entities.ticket },
          ]}
        />
        <AdminSelect
          label={lg.actorLabel}
          value={actor}
          onChange={(v) => {
            setPage(1);
            setActor(v);
          }}
          options={[
            { value: "", label: lg.allActors },
            ...(user?.id ? [{ value: user.id, label: user.email ?? "—" }] : []),
            { value: "system", label: lg.systemOnly },
          ]}
        />
      </AdminFilters>

      {state.kind === "error" ? (
        <AdminError title={t.admin.common.loadErrorTitle} text={t.admin.common.loadErrorText} retry={t.admin.common.retry} onRetry={reload} />
      ) : state.kind === "loading" ? (
        <div className="h-48 animate-pulse rounded-xl border border-line bg-surface-2" aria-busy="true" />
      ) : data && data.items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-dusk">{lg.empty}</p>
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <AdminTable
            head={
              <>
                <th className="px-4 py-2.5 font-semibold">{lg.when}</th>
                <th className="px-4 py-2.5 font-semibold">{lg.object}</th>
                <th className="px-4 py-2.5 font-semibold">{lg.what}</th>
                <th className="px-4 py-2.5 font-semibold">{lg.actorLabel}</th>
              </>
            }
          >
            {(data?.items ?? []).map((e) => (
              <tr key={e.id} className="border-b border-line/60 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-dusk">{new Date(e.createdAt).toLocaleString(locale)}</td>
                <td className="px-4 py-3">
                  <span className="block text-xs text-dusk">{lg.entities[e.entityType]}</span>
                  <span className="block font-medium text-ink">{objectLabel(e, t)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink">{lg.actions[e.action] ?? e.action}</span>
                  {e.action === "ticket_status" && e.meta?.to && (
                    <span className="text-dusk"> → {t.admin.support.statuses[String(e.meta.to) as "open"] ?? String(e.meta.to)}</span>
                  )}
                  {e.reason && <span className="mt-0.5 block max-w-md whitespace-pre-wrap text-xs text-dusk">↳ {e.reason}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-dusk">{e.actorId ? (e.actorName ?? "—") : <span className="text-gold-deep">{lg.system}</span>}</td>
              </tr>
            ))}
          </AdminTable>
        </div>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}
    </div>
  );
}

/** Jurnal yozuvidagi qisqa kontekst: e'lon nomi, kompaniya, baho, murojaat turi. */
function objectLabel(e: ModerationEventView, t: ReturnType<typeof useT>): string {
  const m = e.meta ?? {};
  if (e.entityType === "ticket" && m.kind) {
    const s = t.admin.support;
    const kind = s.kinds[m.kind as keyof typeof s.kinds] ?? String(m.kind);
    const subject = m.subject
      ? (m.kind === "vacancy_report" ? s.reportReasons[m.subject as keyof typeof s.reportReasons] : s.subjects[m.subject as keyof typeof s.subjects]) ?? String(m.subject)
      : null;
    return subject ? `${kind} — ${subject}` : kind;
  }
  if (e.entityType === "vacancy") return [m.title, m.company].filter(Boolean).join(" — ") || e.entityId;
  if (e.entityType === "review") return [m.company, m.rating ? `${m.rating}/5` : null].filter(Boolean).join(" — ") || e.entityId;
  if (e.entityType === "company") return String(m.company ?? e.entityId);
  return e.entityId.slice(-8);
}
