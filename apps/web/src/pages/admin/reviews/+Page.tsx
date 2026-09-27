import React, { useState } from "react";
import {
  AdminActionsHeader,
  AdminShell,
  AdminTable,
  AdminFilters,
  AdminSelect,
  Pager,
  RowButton,
  refreshAdminCounters,
} from "../../../components/AdminShell.js";
import { AdminError, AdminNotice } from "../../../components/admin/AdminStates.js";
import { BulkBar, SelectBox, useSelection } from "../../../components/admin/AdminDialog.js";
import { ModerationBadge } from "../../../components/admin/ModerationBadge.js";
import { useT, useHref, useLocale } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { bulkModerateReviews, deleteAdminReview, fetchAdminReviews, setReviewStatus } from "../../../lib/apiExtra.js";
import { canModerate } from "../../../lib/admin/roles.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import type { AdminReview } from "../../../lib/types.js";

export default function Page() {
  return (
    <AdminShell allow="moderation">
      <ReviewsTable />
    </AdminShell>
  );
}

function ReviewsTable() {
  const t = useT();
  const l = useHref();
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [reviewStatus, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { notice, show } = useNotice();

  const token = status === "authed" && canModerate(user?.role) ? accessToken : null;
  const resourceKey = JSON.stringify({ reviewStatus, page });
  // Xato bo'sh jadval bo'lib ko'rinmaydi, eski javob yangi filtr ustiga yozilmaydi (audit ISSUE-021)
  const { state, pending, reload } = useAdminResource(
    token
      ? (signal) =>
          fetchAdminReviews(token, reviewStatus === "auto" ? { autoApproved: true, page } : { status: reviewStatus, page }, signal)
      : null,
    resourceKey
  );
  const selection = useSelection(resourceKey);

  const afterChange = () => {
    reload();
    refreshAdminCounters();
  };

  async function act(row: AdminReview, action: (token: string) => Promise<unknown>, confirmFirst = false) {
    if (!token || busyId) return;
    // O'chirish qaytarilmaydi — qaysi kompaniya sharhi ekani tasdiqda ko'rinadi (audit R3, admin-staff-12)
    if (confirmFirst && !window.confirm(`${t.admin.common.confirmAction}\n\n${row.companyName} — ${row.rating}/5`)) return;
    setBusyId(row.id);
    try {
      await action(token);
      show("success", t.admin.common.done);
      afterChange();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  async function runBulk(action: "approved" | "rejected" | "delete") {
    const ids = [...selection.selected];
    if (!token || busyId || ids.length === 0) return;
    if (!window.confirm(`${t.admin.common.confirmAction}\n\n${t.admin.bulk.selected(ids.length)}`)) return;
    setBusyId("bulk");
    try {
      const result = await bulkModerateReviews(token, ids, action);
      show(result.failed.length ? "error" : "success", t.admin.bulk.result(result.done, result.failed.length));
      selection.clear();
      afterChange();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  const statusLabels = t.admin.statuses.review;
  const data = state.kind === "ready" ? state.data : null;
  const rows = data?.items ?? [];
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selection.selected.has(id));
  const someSelected = pageIds.some((id) => selection.selected.has(id));

  return (
    <div>
      <AdminFilters>
        <AdminSelect
          label={t.admin.reviews.status}
          value={reviewStatus}
          onChange={(v) => {
            setPage(1);
            setStatusFilter(v);
          }}
          options={[
            { value: "", label: t.admin.vacancies.allStatuses },
            { value: "pending", label: statusLabels.pending },
            { value: "approved", label: statusLabels.approved },
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
        <RowButton tone="primary" disabled={busyId !== null} onClick={() => void runBulk("approved")}>
          {t.admin.bulk.approve}
        </RowButton>
        <RowButton disabled={busyId !== null} onClick={() => void runBulk("rejected")}>
          {t.admin.bulk.reject}
        </RowButton>
        <RowButton tone="danger" disabled={busyId !== null} onClick={() => void runBulk("delete")}>
          {t.admin.bulk.remove}
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
          {t.admin.reviews.empty}
        </p>
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <AdminTable
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
                <th className="px-4 py-2.5 font-semibold">{t.admin.reviews.company}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.reviews.author}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.reviews.status}</th>
                <AdminActionsHeader label={t.contentAdmin.articles.columns.actions} />
              </>
            }
          >
            {rows.map((row) => (
              <tr key={row.id} className={`border-b border-line/60 last:border-0 ${selection.selected.has(row.id) ? "bg-signal/[0.04]" : ""}`}>
                <td className="px-4 py-3 align-top">
                  <SelectBox
                    checked={selection.selected.has(row.id)}
                    onChange={(on) => selection.toggle(row.id, on)}
                    label={t.admin.bulk.select(`${row.companyName} — ${row.rating}/5`)}
                  />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={l(`/companies/${row.companySlug}`)}
                    className="block font-semibold text-ink transition-colors hover:text-signal"
                  >
                    {row.companyName}
                  </a>
                  {/* Yulduzchalar — rasm sifatida: `aria-label` oddiy `span` da e'tiborsiz qolardi (audit R3, gap5-6) */}
                  <span role="img" aria-label={`${row.rating}/5`} className="mt-0.5 block font-mono text-xs text-gold-deep">
                    <span aria-hidden>
                      {"★".repeat(row.rating)}
                      {"☆".repeat(5 - row.rating)}
                    </span>
                  </span>
                  {row.comment && (
                    <span className="mt-1 block max-w-md whitespace-pre-wrap text-xs leading-relaxed text-dusk">{row.comment}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-dusk">
                  {row.authorName}
                  <span className="block text-xs">{new Date(row.createdAt).toLocaleDateString(locale)}</span>
                </td>
                <td className="px-4 py-3 text-dusk">
                  {statusLabels[row.status] ?? row.status}
                  <ModerationBadge autoApproveAt={row.autoApproveAt} autoApprovedAt={row.autoApprovedAt} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {row.status === "approved" && row.autoApprovedAt && (
                      <RowButton tone="primary" disabled={busyId !== null} onClick={() => void act(row, (tk) => setReviewStatus(tk, row.id, "approved"))}>
                        {t.admin.moderation.markReviewed}
                      </RowButton>
                    )}
                    {row.status !== "approved" && (
                      <RowButton tone="primary" disabled={busyId !== null} onClick={() => void act(row, (tk) => setReviewStatus(tk, row.id, "approved"))}>
                        {t.admin.reviews.approve}
                      </RowButton>
                    )}
                    {row.status !== "rejected" && (
                      <RowButton disabled={busyId !== null} onClick={() => void act(row, (tk) => setReviewStatus(tk, row.id, "rejected"))}>
                        {t.admin.reviews.reject}
                      </RowButton>
                    )}
                    <RowButton tone="danger" disabled={busyId !== null} onClick={() => void act(row, (tk) => deleteAdminReview(tk, row.id), true)}>
                      {t.admin.reviews.delete}
                    </RowButton>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}
    </div>
  );
}
