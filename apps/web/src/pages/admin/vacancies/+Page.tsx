import React, { useEffect, useState } from "react";
import {
  AdminActionsHeader,
  AdminShell,
  AdminTable,
  AdminFilters,
  AdminSearchInput,
  AdminSelect,
  Pager,
  RowButton,
  refreshAdminCounters,
} from "../../../components/AdminShell.js";
import { AdminError, AdminNotice } from "../../../components/admin/AdminStates.js";
import { BulkBar, ReasonDialog, SelectBox, useSelection } from "../../../components/admin/AdminDialog.js";
import { ModerationBadge } from "../../../components/admin/ModerationBadge.js";
import { Flag, VacancyReviewPanel } from "../../../components/admin/VacancyReviewPanel.js";
import { useT, useLocale } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { formatNumber } from "../../../lib/format.js";
import { bulkModerateVacancies, fetchAdminVacancies, moderateVacancy } from "../../../lib/apiExtra.js";
import { canModerate } from "../../../lib/admin/roles.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import type { AdminVacancy } from "../../../lib/types.js";

export default function Page() {
  return (
    <AdminShell allow="moderation">
      <VacanciesTable />
    </AdminShell>
  );
}

const STATUS_FILTERS = ["", "moderation", "active", "rejected", "archived", "auto"] as const;

/** `?status=moderation` — moderator navbatdan boshlaydi (bosh sahifadan yo'naltirish). */
function initialStatus(): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get("status") ?? "";
  return (STATUS_FILTERS as readonly string[]).includes(value) ? value : "";
}

type RejectTarget = { ids: string[]; subject: string } | null;

function VacanciesTable() {
  const t = useT();
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [vacancyStatus, setVacancyStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget>(null);
  const { notice, show } = useNotice();

  useEffect(() => setVacancyStatus(initialStatus()), []);

  const token = status === "authed" && canModerate(user?.role) ? accessToken : null;
  const isAdmin = user?.role === "admin";
  const resourceKey = JSON.stringify({ query, vacancyStatus, page });
  // Xato bo'sh jadval bo'lib ko'rinmaydi, eski javob yangi filtr ustiga yozilmaydi (audit ISSUE-021)
  const { state, pending, reload } = useAdminResource(
    // "auto" — holat emas, avto-tasdiqlangan (admin hali ko'rmagan) e'lonlar filtri
    token
      ? (signal) =>
          fetchAdminVacancies(
            token,
            vacancyStatus === "auto" ? { text: query, autoApproved: true, page } : { text: query, status: vacancyStatus, page },
            signal
          )
      : null,
    resourceKey
  );
  const selection = useSelection(resourceKey);

  const afterChange = () => {
    reload();
    refreshAdminCounters();
  };

  async function run(action: () => Promise<unknown>) {
    if (!token || busy) return false;
    setBusy(true);
    try {
      await action();
      show("success", t.admin.common.done);
      afterChange();
      return true;
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Bitta e'lon bo'yicha qaror. Rad etish — sabab oynasi orqali. */
  function decide(row: { id: string; title: string }, input: { status?: "active" | "archived"; isPremium?: boolean }) {
    if (!token) return;
    // E'lonni yopish, chop etish va "premium" belgisi — e'lon nomi bilan tasdiqlanadi (audit R3, admin-staff-12)
    if (!window.confirm(`${t.admin.common.confirmAction}\n\n${row.title}`)) return;
    void run(() => moderateVacancy(token, row.id, input)).then((ok) => ok && input.status && setOpenId(null));
  }

  async function submitReject(reason: string) {
    if (!token || !rejectTarget) return;
    const target = rejectTarget;
    setRejectTarget(null);
    if (target.ids.length === 1) {
      const ok = await run(() => moderateVacancy(token, target.ids[0], { status: "rejected", reason }));
      if (ok) setOpenId(null);
    } else {
      await runBulk("rejected", reason, target.ids);
    }
  }

  async function runBulk(next: "active" | "rejected" | "archived", reason?: string, ids = [...selection.selected]) {
    if (!token || busy || ids.length === 0) return;
    if (next !== "rejected" && !window.confirm(`${t.admin.common.confirmAction}\n\n${t.admin.bulk.selected(ids.length)}`)) return;
    setBusy(true);
    try {
      const result = await bulkModerateVacancies(token, ids, next, reason);
      show(result.failed.length ? "error" : "success", t.admin.bulk.result(result.done, result.failed.length));
      selection.clear();
      afterChange();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusy(false);
    }
  }

  const statusLabels = t.admin.statuses.vacancy;
  const data = state.kind === "ready" ? state.data : null;
  const rows = data?.items ?? [];
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selection.selected.has(id));
  const someSelected = pageIds.some((id) => selection.selected.has(id));

  return (
    <div>
      <AdminFilters>
        <AdminSearchInput
          value={text}
          onChange={setText}
          onSubmit={() => {
            setPage(1);
            setQuery(text.trim());
          }}
          placeholder={t.admin.vacancies.searchPlaceholder}
        />
        <AdminSelect
          label={t.admin.vacancies.status}
          value={vacancyStatus}
          onChange={(v) => {
            setPage(1);
            setVacancyStatus(v);
          }}
          options={[
            { value: "", label: t.admin.vacancies.allStatuses },
            { value: "moderation", label: statusLabels.moderation },
            { value: "active", label: statusLabels.active },
            { value: "archived", label: statusLabels.archived },
            { value: "rejected", label: statusLabels.rejected },
            { value: "auto", label: t.admin.moderation.filterAutoApproved },
          ]}
        />
      </AdminFilters>

      {notice && (
        <div className="mb-3">
          <AdminNotice notice={notice} />
        </div>
      )}

      <BulkBar count={selection.selected.size} onClear={selection.clear}>
        <RowButton tone="primary" disabled={busy} onClick={() => void runBulk("active")}>
          {t.admin.bulk.approve}
        </RowButton>
        <RowButton
          tone="danger"
          disabled={busy}
          onClick={() => setRejectTarget({ ids: [...selection.selected], subject: t.admin.bulk.selected(selection.selected.size) })}
        >
          {t.admin.bulk.reject}
        </RowButton>
        <RowButton disabled={busy} onClick={() => void runBulk("archived")}>
          {t.admin.bulk.archive}
        </RowButton>
      </BulkBar>

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
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-dusk">
          {t.admin.vacancies.empty}
        </p>
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <AdminTable
            minWidth={820}
            head={
              <>
                <th className="w-10 px-4 py-2.5">
                  <SelectBox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(on) => selection.setAll(pageIds, on)}
                    label={t.admin.bulk.selectAll}
                  />
                </th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.nav.vacancies}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.vacancies.status}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.vacancies.views}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.vacancies.applications}</th>
                <AdminActionsHeader label={t.contentAdmin.articles.columns.actions} />
              </>
            }
          >
            {rows.map((row) => (
              <VacancyRow
                key={row.id}
                row={row}
                selected={selection.selected.has(row.id)}
                onSelect={(on) => selection.toggle(row.id, on)}
                busy={busy}
                onOpen={() => setOpenId(row.id)}
                onDecide={(input) => decide(row, input)}
                onReject={() => setRejectTarget({ ids: [row.id], subject: row.title })}
                statusLabel={statusLabels[row.status] ?? row.status}
                locale={locale}
              />
            ))}
          </AdminTable>
        </div>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}

      {token && (
        <VacancyReviewPanel
          token={token}
          vacancyId={openId}
          busy={busy}
          isAdmin={isAdmin}
          onClose={() => setOpenId(null)}
          onDecide={(v, decision) =>
            decision === "rejected" ? setRejectTarget({ ids: [v.id], subject: v.title }) : decide(v, { status: decision })
          }
        />
      )}

      <ReasonDialog
        open={rejectTarget !== null}
        title={t.admin.reject.title}
        subject={rejectTarget?.subject}
        templates={t.admin.reject.templates}
        placeholder={t.admin.reject.placeholder}
        submitLabel={t.admin.reject.submit}
        onCancel={() => setRejectTarget(null)}
        onSubmit={(reason) => void submitReject(reason)}
      />
    </div>
  );
}

function VacancyRow({
  row,
  selected,
  onSelect,
  busy,
  onOpen,
  onDecide,
  onReject,
  statusLabel,
  locale,
}: {
  row: AdminVacancy;
  selected: boolean;
  onSelect: (on: boolean) => void;
  busy: boolean;
  onOpen: () => void;
  onDecide: (input: { status?: "active" | "archived"; isPremium?: boolean }) => void;
  onReject: () => void;
  statusLabel: string;
  locale: string;
}) {
  const t = useT();
  return (
    <tr className={`border-b border-line/60 last:border-0 ${selected ? "bg-signal/[0.04]" : ""}`}>
      <td className="px-4 py-3 align-top">
        <SelectBox checked={selected} onChange={onSelect} label={t.admin.bulk.select(row.title)} />
      </td>
      <td className="px-4 py-3">
        <button type="button" onClick={onOpen} className="block text-left font-semibold text-ink transition-colors hover:text-signal">
          {row.title}
        </button>
        <span className="block text-xs text-dusk">
          {row.companyName}
          {row.regionName ? ` · ${row.regionName}` : ""}
          {row.salaryMin ? ` · ${formatNumber(row.salaryMin, locale)}` : ""}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {row.isPremium && <Flag tone="warn">{t.vacancyCard.premium}</Flag>}
          {row.companyVerified === false && <Flag>{t.admin.flags.unverifiedCompany}</Flag>}
          {row.ownerBlocked && <Flag tone="danger">{t.admin.flags.ownerBlocked}</Flag>}
          {(row.openReports ?? 0) > 0 && <Flag tone="danger">{t.admin.flags.reports(row.openReports ?? 0)}</Flag>}
        </span>
        {row.placementIssue && <span className="mt-1 block text-xs text-gold-deep">⚠ {t.admin.placementIssue[row.placementIssue]}</span>}
        {row.rejectionReason && <span className="mt-1 block text-xs text-dusk">↳ {row.rejectionReason}</span>}
        <ModerationBadge autoApproveAt={row.autoApproveAt} autoApprovedAt={row.autoApprovedAt} />
      </td>
      <td className="px-4 py-3 text-dusk">{statusLabel}</td>
      <td className="px-4 py-3 font-mono text-[13px] text-dusk">{row.viewsCount}</td>
      <td className="px-4 py-3 font-mono text-[13px] text-dusk">{row.applicationCount}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-1.5">
          <RowButton disabled={busy} onClick={onOpen}>
            {t.admin.detail.open}
          </RowButton>
          {/* Qoralamani moderator chop eta olmaydi (audit R3, D-070): server 409 beradi, tugma ham ko'rsatilmaydi.
              Qoidadan o'tmaydigan e'lonni ham tasdiqlab bo'lmaydi — egasi to'ldirishi kerak. */}
          {row.status !== "active" && row.status !== "draft" && !row.placementIssue && !row.ownerBlocked && (
            <RowButton tone="primary" disabled={busy} onClick={() => onDecide({ status: "active" })}>
              {t.admin.vacancies.approve}
            </RowButton>
          )}
          {/* Avto-tasdiqlangan e'lonni admin ko'rib chiqdi — belgi olinadi */}
          {row.status === "active" && row.autoApprovedAt && (
            <RowButton tone="primary" disabled={busy} onClick={() => onDecide({ status: "active" })}>
              {t.admin.moderation.markReviewed}
            </RowButton>
          )}
          {row.status !== "rejected" && (
            <RowButton tone="danger" disabled={busy} onClick={onReject}>
              {t.admin.vacancies.reject}
            </RowButton>
          )}
          {row.status === "active" && (
            <RowButton disabled={busy} onClick={() => onDecide({ status: "archived" })}>
              {t.admin.vacancies.archive}
            </RowButton>
          )}
          <RowButton disabled={busy} onClick={() => onDecide({ isPremium: !row.isPremium })}>
            {row.isPremium ? t.admin.vacancies.removePremium : t.admin.vacancies.makePremium}
          </RowButton>
        </div>
      </td>
    </tr>
  );
}
