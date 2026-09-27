import React, { useState } from "react";
import {
  AdminActionsHeader,
  AdminShell,
  AdminTable,
  AdminFilters,
  AdminSelect,
  Pager,
  RowButton,
} from "../../../components/AdminShell.js";
import { AdminError, AdminNotice } from "../../../components/admin/AdminStates.js";
import { useT, useLocale } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { formatNumber } from "../../../lib/format.js";
import { confirmPayment, fetchAdminPayments } from "../../../lib/apiExtra.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import type { AdminPayment } from "../../../lib/types.js";

export default function Page() {
  return (
    <AdminShell>
      <PaymentsTable />
    </AdminShell>
  );
}

function PaymentsTable() {
  const t = useT();
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { notice, show } = useNotice();

  const token = status === "authed" && user?.role === "admin" ? accessToken : null;
  // Xato bo'sh jadval bo'lib ko'rinmaydi, eski javob yangi filtr ustiga yozilmaydi (audit ISSUE-021)
  const { state, pending, reload } = useAdminResource(
    token ? (signal) => fetchAdminPayments(token, { status: paymentStatus, page }, signal) : null,
    JSON.stringify({ paymentStatus, page })
  );

  async function confirm(row: AdminPayment) {
    if (!token || !row.transactionId || busyId) return;
    // Qaysi to'lov tasdiqlanayotgani ko'rinsin (audit R3, admin-staff-12)
    if (!window.confirm(`${t.admin.common.confirmAction}\n\n${row.companyName} — ${row.transactionId}`)) return;
    setBusyId(row.id);
    try {
      await confirmPayment(token, row.transactionId);
      show("success", t.admin.common.done);
      reload();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  const statusLabels: Record<string, string> = {
    pending: t.pricingExtra.statusPending,
    paid: t.pricingExtra.statusPaid,
    failed: t.pricingExtra.statusFailed,
    refunded: t.pricingExtra.statusRefunded,
  };

  const data = state.kind === "ready" ? state.data : null;

  return (
    <div>
      <AdminFilters>
        <AdminSelect
          label={t.admin.payments.status}
          value={paymentStatus}
          onChange={(v) => {
            setPage(1);
            setPaymentStatus(v);
          }}
          options={[
            { value: "", label: t.admin.vacancies.allStatuses },
            { value: "pending", label: statusLabels.pending },
            { value: "paid", label: statusLabels.paid },
            { value: "failed", label: statusLabels.failed },
            { value: "refunded", label: statusLabels.refunded },
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
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-dusk">
          {t.admin.payments.empty}
        </p>
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <AdminTable
            head={
              <>
                <th className="px-4 py-2.5 font-semibold">{t.admin.payments.company}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.payments.plan}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.payments.amount}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.payments.provider}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.payments.status}</th>
                <AdminActionsHeader label={t.contentAdmin.articles.columns.actions} />
              </>
            }
          >
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">
                  <span className="block font-semibold text-ink">{row.companyName}</span>
                  <span className="block font-mono text-[11px] text-dusk">{row.transactionId}</span>
                </td>
                <td className="px-4 py-3 text-dusk">{row.planName}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-ink">{formatNumber(row.amount)}</td>
                <td className="px-4 py-3 text-dusk">{row.provider}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      row.status === "paid" ? "bg-growth/10 text-growth" : "bg-surface-2 text-dusk"
                    }`}
                  >
                    {statusLabels[row.status] ?? row.status}
                  </span>
                  {row.paidAt && (
                    <span className="mt-1 block text-xs text-dusk">{new Date(row.paidAt).toLocaleDateString()}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.status === "pending" && row.transactionId && (
                    <RowButton tone="primary" disabled={busyId !== null} onClick={() => void confirm(row)}>
                      {t.admin.payments.confirm}
                    </RowButton>
                  )}
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
