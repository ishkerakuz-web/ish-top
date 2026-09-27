import React from "react";
import { useHref, useLocale, useT } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import { fetchAdminVacancy } from "../../lib/apiExtra.js";
import { useAdminResource } from "../../lib/admin/useAdminResource.js";
import type { AdminVacancyDetail } from "../../lib/types.js";
import { AdminDialog } from "./AdminDialog.js";
import { ModerationBadge } from "./ModerationBadge.js";
import { ModerationHistory } from "./ModerationHistory.js";

type Decision = "active" | "rejected" | "archived";

/**
 * Vakansiyani tasdiqlashdan oldin to'liq ko'rish: matn, aloqa, kompaniya konteksti, shikoyatlar va
 * qarorlar tarixi. Ilgari moderator faqat sarlavhani ko'rib "tasdiqlash"ni bosardi.
 */
export function VacancyReviewPanel({
  token,
  vacancyId,
  onClose,
  onDecide,
  busy,
  isAdmin,
}: {
  token: string;
  vacancyId: string | null;
  onClose: () => void;
  onDecide: (vacancy: AdminVacancyDetail, decision: Decision) => void;
  busy: boolean;
  isAdmin: boolean;
}) {
  const t = useT();
  const d = t.admin.detail;
  const l = useHref();
  const { locale } = useLocale();
  const { state, reload } = useAdminResource(
    vacancyId ? (signal) => fetchAdminVacancy(token, vacancyId, signal) : null,
    vacancyId ?? "none"
  );
  const v = state.kind === "ready" ? state.data : null;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : "—");

  const salary = v
    ? v.salaryMin || v.salaryMax
      ? `${v.salaryMin ? formatNumber(v.salaryMin, locale) : "…"} – ${v.salaryMax ? formatNumber(v.salaryMax, locale) : "…"} ${v.currency}${v.isSalaryHidden ? ` (${d.salaryHidden})` : ""}`
      : "—"
    : "";

  const footer = v ? (
    <>
      {v.status !== "active" && v.status !== "draft" && (
        <button
          type="button"
          disabled={busy || Boolean(v.placementIssue) || v.company.ownerBlocked}
          onClick={() => onDecide(v, "active")}
          className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-50"
        >
          {t.admin.vacancies.approve}
        </button>
      )}
      {v.status === "active" && v.autoApprovedAt && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(v, "active")}
          className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-50"
        >
          {t.admin.moderation.markReviewed}
        </button>
      )}
      {v.status !== "rejected" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(v, "rejected")}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50"
        >
          {t.admin.vacancies.reject}
        </button>
      )}
      {v.status === "active" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide(v, "archived")}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-signal/40 disabled:opacity-50"
        >
          {t.admin.vacancies.archive}
        </button>
      )}
    </>
  ) : undefined;

  return (
    <AdminDialog open={vacancyId !== null} onClose={onClose} title={v?.title ?? t.admin.nav.vacancies} side="right" closeLabel={d.close} footer={footer}>
      {state.kind === "loading" ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-5 w-1/2 animate-pulse rounded bg-surface-2" />
          <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
        </div>
      ) : state.kind === "error" || !v ? (
        <div role="alert" className="text-sm text-danger">
          {d.loadError}{" "}
          <button type="button" className="underline" onClick={reload}>
            {t.admin.common.retry}
          </button>
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink">{t.admin.statuses.vacancy[v.status]}</span>
            {!v.company.isVerified && <Flag tone="warn">{t.admin.flags.unverifiedCompany}</Flag>}
            {v.company.ownerBlocked && <Flag tone="danger">{t.admin.flags.ownerBlocked}</Flag>}
            {v.reports.filter((r) => r.status === "open" || r.status === "in_progress").length > 0 && (
              <Flag tone="danger">{t.admin.flags.reports(v.reports.filter((r) => r.status === "open" || r.status === "in_progress").length)}</Flag>
            )}
            {v.status === "active" && (
              <a href={l(`/vacancies/${v.slug}`)} target="_blank" rel="noreferrer" className="ml-auto text-xs font-medium text-signal hover:underline">
                {d.openPublic} ↗
              </a>
            )}
          </div>
          <ModerationBadge autoApproveAt={v.autoApproveAt} autoApprovedAt={v.autoApprovedAt} />
          {v.placementIssue && (
            <p role="status" className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold-deep">
              {t.admin.placementIssue[v.placementIssue]}
            </p>
          )}
          {v.rejectionReason && <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-dusk">↳ {v.rejectionReason}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-line p-3 text-xs">
            <Field label={d.salary}>{salary}</Field>
            <Field label={d.category}>{v.categoryName ?? "—"}</Field>
            <Field label={d.region}>{v.regionName ?? "—"}{v.address ? ` · ${v.address}` : ""}</Field>
            <Field label={d.workplace}>{v.workplaceType ? t.enums.workplace[v.workplaceType as "office"] ?? v.workplaceType : "—"}</Field>
            <Field label={d.employment}>{t.enums.employment[v.employmentType as "full_time"] ?? v.employmentType}</Field>
            <Field label={d.created}>{date(v.createdAt)}</Field>
            {v.moderationSubmittedAt && <Field label={d.submitted}>{date(v.moderationSubmittedAt)}</Field>}
            {v.publishedAt && <Field label={d.published}>{date(v.publishedAt)}</Field>}
          </dl>

          <Section title={d.description}>
            <p className="whitespace-pre-wrap leading-relaxed text-ink">{v.description}</p>
          </Section>
          {v.requirements && (
            <Section title={d.requirements}>
              <p className="whitespace-pre-wrap leading-relaxed text-ink">{v.requirements}</p>
            </Section>
          )}
          {v.conditions && (
            <Section title={d.conditions}>
              <p className="whitespace-pre-wrap leading-relaxed text-ink">{v.conditions}</p>
            </Section>
          )}
          {(v.contactEmail || v.contactTelegram || v.contactPhone) && (
            <Section title={d.contacts}>
              <ul className="space-y-0.5 text-ink">
                {v.contactEmail && <li>{v.contactEmail}</li>}
                {v.contactTelegram && <li>Telegram: {v.contactTelegram}</li>}
                {v.contactPhone && <li>{v.contactPhone}</li>}
              </ul>
            </Section>
          )}

          <Section title={d.company}>
            <div className="rounded-xl border border-line p-3 text-xs">
              <a href={l(`/companies/${v.company.slug}`)} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-signal">
                {v.company.name}
              </a>
              <p className="mt-1 text-dusk">
                {d.owner}: {v.company.ownerEmail}
                {v.company.ownerPhoneMasked ? ` · ${v.company.ownerPhoneMasked}` : ""}
              </p>
              {v.company.website && (
                <p className="text-dusk">
                  {d.website}: {v.company.website}
                </p>
              )}
              <p className="mt-1 text-dusk">
                {d.companyVacancies}:{" "}
                {(Object.entries(v.company.vacancies) as [keyof typeof t.admin.statuses.vacancy, number][])
                  .map(([status, n]) => `${t.admin.statuses.vacancy[status]} ${n}`)
                  .join(" · ") || "—"}
              </p>
              {isAdmin && (
                <a href={l(`/admin/users/${v.company.ownerUserId}`)} className="mt-1 inline-block font-medium text-signal hover:underline">
                  {d.ownerProfile} →
                </a>
              )}
            </div>
          </Section>

          <Section title={d.reports}>
            {v.reports.length === 0 ? (
              <p className="text-dusk">{d.noReports}</p>
            ) : (
              <ul className="space-y-2">
                {v.reports.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line p-2.5 text-xs">
                    <span className="font-semibold text-ink">
                      {t.admin.support.reportReasons[r.subject as "other"] ?? r.subject ?? "—"}
                    </span>{" "}
                    <span className="text-dusk">· {t.admin.support.statuses[r.status]} · {date(r.createdAt)}</span>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{r.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={d.history}>
            <ModerationHistory events={v.history} empty={d.noHistory} />
          </Section>
        </div>
      )}
    </AdminDialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-dusk">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-dusk">{label}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  );
}

export function Flag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "danger" }) {
  const cls = {
    neutral: "bg-surface-2 text-dusk",
    warn: "bg-gold/20 text-gold-deep",
    danger: "bg-danger/10 text-danger",
  }[tone];
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{children}</span>;
}
