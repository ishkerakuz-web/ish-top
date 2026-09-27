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
  useAdminBilling,
} from "../../../components/AdminShell.js";
import { AdminError, AdminNotice } from "../../../components/admin/AdminStates.js";
import { ReasonDialog } from "../../../components/admin/AdminDialog.js";
import { Flag } from "../../../components/admin/VacancyReviewPanel.js";
import { canModerate } from "../../../lib/admin/roles.js";
import { useT, useHref, useLocale } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { fetchAdminCompanies, verifyCompany } from "../../../lib/apiExtra.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import type { AdminCompany } from "../../../lib/types.js";

export default function Page() {
  return (
    <AdminShell allow="moderation">
      <CompaniesTable />
    </AdminShell>
  );
}

function CompaniesTable() {
  const t = useT();
  const l = useHref();
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // "requested" — tasdiq so'rovi yuborganlar (navbat)
  const [filter, setFilter] = useState<"" | "requested" | "verified" | "unverified">("");
  // `?filter=requested` — bosh sahifadagi "Tasdiq so'rovlari" kartasidan
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("filter");
    if (value === "requested" || value === "verified" || value === "unverified") setFilter(value);
  }, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminCompany | null>(null);
  const { notice, show } = useNotice();
  // Tarif ustuni faqat monetizatsiya yoqilganda (audit R3, D-065)
  const billingEnabled = useAdminBilling();

  const token = status === "authed" && canModerate(user?.role) ? accessToken : null;
  // Xato bo'sh jadval bo'lib ko'rinmaydi, eski javob yangi filtr ustiga yozilmaydi (audit ISSUE-021)
  const { state, pending, reload } = useAdminResource(
    token
      ? (signal) =>
          fetchAdminCompanies(
            token,
            {
              text: query,
              page,
              ...(filter === "requested" ? { requested: true } : {}),
              ...(filter === "verified" ? { verified: true } : filter === "unverified" ? { verified: false } : {}),
            },
            signal
          )
      : null,
    JSON.stringify({ query, page, filter })
  );

  async function decide(row: AdminCompany, isVerified: boolean, note?: string) {
    if (!token || busyId) return;
    setBusyId(row.id);
    try {
      await verifyCompany(token, row.id, isVerified, note);
      show("success", t.admin.common.done);
      reload();
      refreshAdminCounters();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleVerify(row: AdminCompany) {
    if (!token || busyId) return;
    // Tasdiqni olib tashlash — kompaniya sahifasidagi belgini yo'qotadi: nomi bilan tasdiqlatiladi (audit R3, admin-staff-12)
    if (row.isVerified && !window.confirm(`${t.admin.common.confirmAction}\n\n${row.name}`)) return;
    setBusyId(row.id);
    try {
      await verifyCompany(token, row.id, !row.isVerified);
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
        <AdminSearchInput
          value={text}
          onChange={setText}
          onSubmit={() => {
            setPage(1);
            setQuery(text.trim());
          }}
          placeholder={t.admin.companies.searchPlaceholder}
        />
        <AdminSelect
          label={t.admin.companiesExtra.filterLabel}
          value={filter}
          onChange={(v) => {
            setPage(1);
            setFilter(v as typeof filter);
          }}
          options={[
            { value: "", label: t.admin.companiesExtra.filterAll },
            { value: "requested", label: t.admin.companiesExtra.filterRequested },
            { value: "verified", label: t.admin.companiesExtra.filterVerified },
            { value: "unverified", label: t.admin.companiesExtra.filterUnverified },
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
          {t.admin.companies.empty}
        </p>
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <AdminTable
            head={
              <>
                <th className="px-4 py-2.5 font-semibold">{t.admin.nav.companies}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.companies.owner}</th>
                {billingEnabled && <th className="px-4 py-2.5 font-semibold">{t.admin.companies.plan}</th>}
                <th className="px-4 py-2.5 font-semibold">{t.admin.companies.vacancies}</th>
                <AdminActionsHeader label={t.contentAdmin.articles.columns.actions} />
              </>
            }
          >
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">
                  <a
                    href={l(`/companies/${row.slug}`)}
                    className="block font-semibold text-ink transition-colors hover:text-signal"
                  >
                    {row.name}
                  </a>
                  {row.isVerified && (
                    <span className="mt-1 inline-block rounded-md bg-growth/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-growth">
                      {t.admin.companies.verified}
                    </span>
                  )}
                  {!row.isVerified && row.verificationRequestedAt && (
                    <span className="mt-1 block">
                      <Flag tone="warn">{t.admin.companiesExtra.requested}</Flag>{" "}
                      <span className="text-xs text-dusk">{new Date(row.verificationRequestedAt).toLocaleString(locale)}</span>
                    </span>
                  )}
                  {(row.legalName || row.stir) && (
                    <span className="mt-1 block text-xs text-dusk">
                      {row.legalName ? `${t.admin.companiesExtra.legalName}: ${row.legalName}` : ""}
                      {row.stir ? ` · ${t.admin.companiesExtra.stir}: ${row.stir}` : ""}
                    </span>
                  )}
                  {row.website && <span className="block text-xs text-dusk">{row.website}</span>}
                  {row.verificationNote && !row.isVerified && (
                    <span className="mt-1 block text-xs text-dusk">
                      ↳ {t.admin.companiesExtra.lastNote}: {row.verificationNote}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-dusk">{row.ownerEmail}</td>
                {billingEnabled && (
                  <td className="px-4 py-3 text-dusk">
                    {row.planName ?? "—"}
                    {row.subscriptionExpiresAt && (
                      <span className="block text-xs">{new Date(row.subscriptionExpiresAt).toLocaleDateString()}</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-[13px] text-dusk">
                  {row.vacancyCount} · {row.reviewCount} {t.admin.companies.reviews}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <RowButton tone={row.isVerified ? "neutral" : "primary"} disabled={busyId !== null} onClick={() => void toggleVerify(row)}>
                      {row.isVerified ? t.admin.companies.unverify : t.admin.companies.verify}
                    </RowButton>
                    {!row.isVerified && row.verificationRequestedAt && (
                      <RowButton tone="danger" disabled={busyId !== null} onClick={() => setRejecting(row)}>
                        {t.admin.companiesExtra.rejectRequest}
                      </RowButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}

      <ReasonDialog
        open={rejecting !== null}
        title={t.admin.companiesExtra.rejectRequest}
        subject={rejecting?.name}
        placeholder={t.admin.companiesExtra.rejectPrompt}
        submitLabel={t.admin.companiesExtra.rejectRequest}
        onCancel={() => setRejecting(null)}
        onSubmit={(note) => {
          const row = rejecting;
          setRejecting(null);
          if (row) void decide(row, false, note);
        }}
      />
    </div>
  );
}
