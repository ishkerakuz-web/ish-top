import React, { useState } from "react";
import { AdminFilters, AdminSelect, Pager } from "../AdminShell.js";
import { ADMIN_CARD, ADMIN_INPUT, ADMIN_LABEL, AdminEmpty, AdminError, AdminNotice } from "./AdminStates.js";
import { IconAlert } from "./icons.js";
import { useAuth } from "../AuthContext.js";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { useAdminResource } from "../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../lib/admin/useNotice.js";
import {
  approveRecoveryRequest,
  fetchRecoveryRequests,
  fetchSecurityEvents,
  rejectRecoveryRequest,
  type RecoveryRequestItem,
  type SecurityEventItem,
} from "../../lib/auth/recovery.js";

/**
 * Qo'lda tiklash so'rovlari — mavjud `/admin/users` sahifasining ko'rinishi
 * (audit R3, D-049, D-063). Yangi sahifa yaratilmaydi.
 *
 * Admin faqat tasdiqlaydi yoki rad etadi: parol, reset havolasi va so'rov kodi
 * hech qachon ko'rsatilmaydi, telefon raqamlari niqoblangan holda keladi.
 */
export function RecoveryRequests() {
  const t = useT();
  const r = t.admin.recovery;
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { notice, show } = useNotice();

  const token = status === "authed" && user?.role === "admin" ? accessToken : null;
  // Xato bo'sh ro'yxat bo'lib ko'rinmaydi (audit ISSUE-021)
  const { state, pending, reload } = useAdminResource(
    token ? (signal) => fetchRecoveryRequests(token, { status: statusFilter, page }, signal) : null,
    JSON.stringify({ statusFilter, page })
  );

  async function review(item: RecoveryRequestItem, approve: boolean, note: string) {
    if (!token || busyId) return;
    if (approve && !window.confirm(t.admin.common.confirmAction)) return;
    setBusyId(item.id);
    try {
      if (approve) await approveRecoveryRequest(token, item.id, note.trim() || undefined);
      else await rejectRecoveryRequest(token, item.id, note.trim() || undefined);
      show("success", t.admin.common.done);
      reload();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  const data = state.kind === "ready" ? state.data : null;

  return (
    <div>
      <div className={`${ADMIN_CARD} mb-4`}>
        <h2 className="font-display text-lg font-bold text-ink">{r.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-dusk">{r.subtitle}</p>
      </div>

      <AdminFilters>
        <AdminSelect
          label={r.statusLabel}
          value={statusFilter}
          onChange={(v) => {
            setPage(1);
            setStatusFilter(v);
          }}
          options={[
            { value: "", label: r.allStatuses },
            { value: "pending", label: r.status.pending },
            { value: "approved", label: r.status.approved },
            { value: "rejected", label: r.status.rejected },
            { value: "completed", label: r.status.completed },
            { value: "expired", label: r.status.expired },
          ]}
        />
      </AdminFilters>

      {notice && (
        <div className="mb-3">
          <AdminNotice notice={notice} />
        </div>
      )}

      {state.kind === "error" ? (
        <AdminError
          title={t.admin.common.loadErrorTitle}
          text={t.admin.common.loadErrorText}
          retry={t.admin.common.retry}
          onRetry={reload}
        />
      ) : state.kind === "loading" ? (
        <div className="h-48 animate-pulse rounded-xl border border-line bg-surface-2" aria-busy="true" />
      ) : data && data.items.length === 0 ? (
        <AdminEmpty icon={<IconAlert size={22} />} title={r.empty} text={r.subtitle} />
      ) : (
        <div className={`flex flex-col gap-4 ${pending ? "opacity-60 transition-opacity" : ""}`} aria-busy={pending || undefined}>
          {(data?.items ?? []).map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              token={token}
              busy={busyId === item.id}
              onReview={(approve, note) => void review(item, approve, note)}
            />
          ))}
        </div>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}
    </div>
  );
}

function RequestCard({
  item,
  token,
  busy,
  onReview,
}: {
  item: RecoveryRequestItem;
  token: string | null;
  busy: boolean;
  onReview: (approve: boolean, note: string) => void;
}) {
  const t = useT();
  const r = t.admin.recovery;
  const [note, setNote] = useState("");
  const noteId = `recovery-note-${item.id}`;
  const account = item.account;
  // Hisobi topilmagan so'rov ham ko'rib chiqiladi: server uni tasdiqlashni rad etadi
  // (409 ACCOUNT_NOT_FOUND) — admin bunday so'rovni RAD ETA olishi kerak (audit R3, D-049)
  const canReview = item.status === "pending";

  return (
    <article className={ADMIN_CARD}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold text-ink">{item.fullName}</h3>
          <p className="mt-0.5 break-all text-[13px] text-dusk">{item.email}</p>
        </div>
        <StatusBadge status={item.status} />
      </header>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={r.details}>
          <span className="whitespace-pre-wrap break-words">{item.details}</span>
        </Field>
        <div className="flex flex-col gap-3">
          <Field label={r.contact}>{item.contact || r.none}</Field>
          <Field label={r.created}>{new Date(item.createdAt).toLocaleString()}</Field>
        </div>
      </dl>

      <section className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3.5">
        <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-dusk">{r.account}</h4>
        {account.exists ? (
          <dl className="mt-2 grid gap-2 text-[13px] sm:grid-cols-2">
            <Line label={r.accountRole} value={account.role ?? r.none} />
            <Line
              label={r.accountCreated}
              value={account.createdAt ? new Date(account.createdAt).toLocaleDateString() : r.none}
            />
            <Line label={r.phone} value={account.phoneMasked || r.none} />
            <Line label={r.backupPhone} value={account.backupPhoneMasked || r.none} />
            <Line label={r.telegram} value={account.telegramLinked ? r.telegramLinked : r.telegramNotLinked} />
            {account.isBlocked && <Line label={r.accountBlocked} value={r.accountBlocked} />}
          </dl>
        ) : (
          // Hisob yo'qligi so'rov yuboruvchiga hech qachon aytilmaydi — faqat admin ko'radi
          <p className="mt-2 text-[13px] text-dusk">{r.accountMissing}</p>
        )}
      </section>

      {item.reviewedAt && (
        <p className="mt-3 text-[13px] text-dusk">
          {r.reviewed}: {new Date(item.reviewedAt).toLocaleString()}
          {item.reviewNote ? ` · ${r.reviewNote}: ${item.reviewNote}` : ""}
        </p>
      )}

      {canReview && (
        <div className="mt-4">
          <label htmlFor={noteId} className={ADMIN_LABEL}>
            {r.note}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={r.notePlaceholder}
            className={`${ADMIN_INPUT} mt-1`}
          />
          <p className="mt-1.5 text-[12.5px] text-dusk">{r.approveHint}</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={busy || !account.exists}
              onClick={() => onReview(true, note)}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-signal px-4 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {r.approve}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReview(false, note)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-danger/30 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {r.reject}
            </button>
          </div>
        </div>
      )}

      {account.exists && account.id && token && <SecurityEvents token={token} userId={account.id} />}
    </article>
  );
}

/** Oxirgi xavfsizlik hodisalari — faqat so'ralganda yuklanadi. */
function SecurityEvents({ token, userId }: { token: string; userId: string }) {
  const t = useT();
  const r = t.admin.recovery;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [items, setItems] = useState<SecurityEventItem[]>([]);

  async function load() {
    setPhase("loading");
    try {
      const res = await fetchSecurityEvents(token, userId);
      setItems(res.items ?? []);
      setPhase("ready");
    } catch {
      // Xato bo'sh ro'yxat bo'lib ko'rinmaydi
      setPhase("error");
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && phase === "idle") void load();
        }}
        className="text-[13px] font-semibold text-signal transition-colors hover:text-signal-dark"
      >
        {open ? r.eventsHide : r.eventsShow}
      </button>

      {open && (
        <div className="mt-2.5">
          {phase === "loading" && (
            <p className="text-[13px] text-dusk" role="status">
              {r.eventsLoading}
            </p>
          )}
          {phase === "error" && (
            <div role="alert" className="flex flex-wrap items-center gap-2.5">
              <p className="text-[13px] text-danger">{r.eventsError}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-dusk transition-colors hover:text-ink"
              >
                {t.admin.common.retry}
              </button>
            </div>
          )}
          {phase === "ready" &&
            (items.length === 0 ? (
              <p className="text-[13px] text-dusk">{r.eventsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                    <span className="font-medium text-ink">{r.eventType[event.type] ?? event.type}</span>
                    <span className="font-mono text-[12px] text-dusk">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: RecoveryRequestItem["status"] }) {
  const t = useT();
  const r = t.admin.recovery;
  const tone =
    status === "approved" || status === "completed"
      ? "bg-growth/10 text-growth"
      : status === "rejected" || status === "expired"
        ? "bg-danger/10 text-danger"
        : "bg-gold/20 text-gold-deep";
  return (
    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold ${tone}`}>{r.status[status]}</span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-dusk">{label}</dt>
      <dd className="mt-1 text-[13.5px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-dusk">{label}:</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
