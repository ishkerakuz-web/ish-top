import React, { useState } from "react";
import { AdminShell, AdminFilters, AdminSelect, Pager, RowButton, refreshAdminCounters } from "../../../components/AdminShell.js";
import { AdminEmpty, AdminError, AdminNotice, ADMIN_INPUT } from "../../../components/admin/AdminStates.js";
import { ReasonDialog } from "../../../components/admin/AdminDialog.js";
import { Flag } from "../../../components/admin/VacancyReviewPanel.js";
import { useT, useHref, useLocale } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { fetchAdminSupport, moderateVacancy, replySupportTicket, updateSupportTicket } from "../../../lib/apiExtra.js";
import { canModerate } from "../../../lib/admin/roles.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import type { AdminSupportTicket, SupportTicketStatus } from "../../../lib/types.js";

/**
 * Murojaatlar qutisi: aloqa formasi va vakansiya shikoyatlari. Holat (yangi → ko'rilmoqda →
 * hal qilindi/rad etildi), ichki izoh, emailga javob va shikoyat qilingan e'lonni yopish.
 */
export default function Page() {
  return (
    <AdminShell allow="moderation">
      <SupportInbox />
    </AdminShell>
  );
}

function SupportInbox() {
  const t = useT();
  const s = t.admin.support;
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<AdminSupportTicket | null>(null);
  const { notice, show } = useNotice();

  const token = status === "authed" && canModerate(user?.role) ? accessToken : null;
  const { state, pending, reload } = useAdminResource(
    token ? (signal) => fetchAdminSupport(token, { status: statusFilter, kind, page }, signal) : null,
    JSON.stringify({ statusFilter, kind, page })
  );

  async function act(id: string, action: (token: string) => Promise<unknown>, confirmText?: string) {
    if (!token || busyId) return;
    if (confirmText && !window.confirm(`${t.admin.common.confirmAction}\n\n${confirmText}`)) return;
    setBusyId(id);
    try {
      await action(token);
      show("success", t.admin.common.done);
      reload();
      refreshAdminCounters();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  const data = state.kind === "ready" ? state.data : null;

  return (
    <div>
      <AdminFilters>
        <AdminSelect
          label={s.statusLabel}
          value={statusFilter}
          onChange={(v) => {
            setPage(1);
            setStatusFilter(v);
          }}
          options={[
            { value: "", label: s.allStatuses },
            { value: "open", label: s.statuses.open },
            { value: "in_progress", label: s.statuses.in_progress },
            { value: "resolved", label: s.statuses.resolved },
            { value: "dismissed", label: s.statuses.dismissed },
          ]}
        />
        <AdminSelect
          label={s.kindLabel}
          value={kind}
          onChange={(v) => {
            setPage(1);
            setKind(v);
          }}
          options={[
            { value: "", label: s.allKinds },
            { value: "vacancy_report", label: s.kinds.vacancy_report },
            { value: "contact", label: s.kinds.contact },
          ]}
        />
      </AdminFilters>

      {notice && (
        <div className="mb-3">
          <AdminNotice notice={notice} />
        </div>
      )}

      {state.kind === "error" ? (
        <AdminError title={t.admin.common.loadErrorTitle} text={t.admin.common.loadErrorText} retry={t.admin.common.retry} onRetry={reload} />
      ) : state.kind === "loading" ? (
        <div className="h-48 animate-pulse rounded-xl border border-line bg-surface-2" aria-busy="true" />
      ) : data && data.items.length === 0 ? (
        <AdminEmpty icon={<span aria-hidden>✉</span>} title={s.empty} text="" />
      ) : (
        <ul className={`space-y-3 ${pending ? "opacity-60 transition-opacity" : ""}`} aria-busy={pending || undefined}>
          {(data?.items ?? []).map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              canReply={data?.canReply ?? false}
              busy={busyId !== null}
              onStatus={(next) => void act(ticket.id, (tk) => updateSupportTicket(tk, ticket.id, { status: next }))}
              onNote={(note) => void act(ticket.id, (tk) => updateSupportTicket(tk, ticket.id, { adminNote: note }))}
              onReply={() => setReplyTo(ticket)}
              onArchiveVacancy={() =>
                ticket.vacancy &&
                void act(
                  ticket.id,
                  async (tk) => {
                    await moderateVacancy(tk, ticket.vacancy!.id, { status: "archived" });
                    await updateSupportTicket(tk, ticket.id, { status: "resolved" });
                  },
                  ticket.vacancy.title
                )
              }
            />
          ))}
        </ul>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}

      <ReasonDialog
        open={replyTo !== null}
        title={s.reply}
        subject={replyTo?.email ?? undefined}
        placeholder={s.replyPlaceholder}
        submitLabel={s.send}
        onCancel={() => setReplyTo(null)}
        onSubmit={(message) => {
          const ticket = replyTo;
          setReplyTo(null);
          if (ticket) void act(ticket.id, (tk) => replySupportTicket(tk, ticket.id, message));
        }}
      />
    </div>
  );
}

function TicketCard({
  ticket,
  canReply,
  busy,
  onStatus,
  onNote,
  onReply,
  onArchiveVacancy,
}: {
  ticket: AdminSupportTicket;
  canReply: boolean;
  busy: boolean;
  onStatus: (status: SupportTicketStatus) => void;
  onNote: (note: string | null) => void;
  onReply: () => void;
  onArchiveVacancy: () => void;
}) {
  const t = useT();
  const s = t.admin.support;
  const l = useHref();
  const { locale } = useLocale();
  const [note, setNote] = useState(ticket.adminNote ?? "");
  const closed = ticket.status === "resolved" || ticket.status === "dismissed";
  const subject =
    ticket.kind === "vacancy_report"
      ? (s.reportReasons[ticket.subject as keyof typeof s.reportReasons] ?? ticket.subject)
      : ticket.subject
        ? (s.subjects[ticket.subject as keyof typeof s.subjects] ?? ticket.subject)
        : null;

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Flag tone={ticket.kind === "vacancy_report" ? "danger" : "neutral"}>{s.kinds[ticket.kind]}</Flag>
        {subject && <span className="text-sm font-semibold text-ink">{subject}</span>}
        <span className="ml-auto text-xs text-dusk">
          {s.statuses[ticket.status]} · {new Date(ticket.createdAt).toLocaleString(locale)}
        </span>
      </div>

      {ticket.vacancy && (
        <p className="mt-2 text-sm">
          <span className="text-dusk">{s.vacancy}: </span>
          {ticket.vacancy.status === "active" ? (
            <a href={l(`/vacancies/${ticket.vacancy.slug}`)} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-signal">
              {ticket.vacancy.title}
            </a>
          ) : (
            <span className="font-semibold text-ink">{ticket.vacancy.title}</span>
          )}
          <span className="text-dusk">
            {" "}
            · {ticket.vacancy.companyName} · {t.admin.statuses.vacancy[ticket.vacancy.status]}
          </span>
        </p>
      )}

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{ticket.message}</p>

      <p className="mt-2 text-xs text-dusk">
        {s.from}:{" "}
        {[
          ticket.name,
          ticket.email && ticket.email !== ticket.account?.email ? ticket.email : null,
          ticket.account ? `${ticket.account.email} (${t.admin.roleNames[ticket.account.role]})` : null,
        ]
          .filter(Boolean)
          .join(" · ") || s.anonymous}
        {ticket.repliedAt ? ` · ${s.replied}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className="sr-only">{s.note}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={`${s.note} — ${s.notePlaceholder}`} className={`${ADMIN_INPUT} py-1.5 text-xs`} />
        </label>
        {note !== (ticket.adminNote ?? "") && (
          <RowButton disabled={busy} onClick={() => onNote(note.trim() || null)}>
            {s.saveNote}
          </RowButton>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ticket.status === "open" && (
          <RowButton disabled={busy} onClick={() => onStatus("in_progress")}>
            {s.markInProgress}
          </RowButton>
        )}
        {!closed && (
          <RowButton tone="primary" disabled={busy} onClick={() => onStatus("resolved")}>
            {s.resolve}
          </RowButton>
        )}
        {!closed && (
          <RowButton disabled={busy} onClick={() => onStatus("dismissed")}>
            {s.dismiss}
          </RowButton>
        )}
        {closed && (
          <RowButton disabled={busy} onClick={() => onStatus("open")}>
            {s.reopen}
          </RowButton>
        )}
        {ticket.vacancy?.status === "active" && !closed && (
          <RowButton tone="danger" disabled={busy} onClick={onArchiveVacancy}>
            {s.archiveVacancy}
          </RowButton>
        )}
        {ticket.email ? (
          canReply ? (
            <RowButton disabled={busy} onClick={onReply}>
              {s.reply}
            </RowButton>
          ) : (
            <span className="self-center text-xs text-dusk">{s.replyUnavailable}</span>
          )
        ) : (
          <span className="self-center text-xs text-dusk">{s.noEmail}</span>
        )}
      </div>
    </li>
  );
}
