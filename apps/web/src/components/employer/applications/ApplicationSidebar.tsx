import React, { useEffect, useId, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { formatSalary } from "../../../lib/format.js";
import { SETTABLE_STATUSES, regionLabel, type EmployerApplicationVM, type SettableStatus } from "../../../lib/employer/applications/adapter.js";
import { PhoneGateNotice } from "../../PhoneGateNotice.js";
import { Field, SelectInput, TextArea } from "../vacancies/form/FormControls.js";
import { CTA_PRIMARY } from "../vacancies/styles.js";
import { IconBriefcase, IconBuilding, IconChat, IconCheckCircle, IconExternal, IconInterview, IconPin, IconUsers, IconWallet, IconXCircle, Spinner } from "./icons.js";

export type QuickAction = "invite" | "accept" | "reject";
const CARD = "rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-5";
const CARD_TITLE = "font-display text-[16px] font-semibold text-ink";

/**
 * O'ng panel — tanlangan ARIZA bilan ishlash: holat (backend qo'yishga ruxsat bergan qiymatlar),
 * tezkor amallar (faqat mavjud backend amallari), vakansiya kartasi.
 * Eslatmalar va suhbat vaqtini belgilash backendda yo'q — ko'rsatilmaydi.
 */
export function ApplicationSidebar({
  application: a,
  busy,
  messageBusy,
  gated,
  headingRef,
  onUpdate,
  onQuick,
  onMessage,
  onFilterVacancy,
}: {
  application: EmployerApplicationVM;
  busy: boolean;
  messageBusy: boolean;
  gated: boolean;
  /** Holat o'zgargandan keyin fokus shu sarlavhaga qaytadi (audit R3, gap5-4). */
  headingRef?: React.RefObject<HTMLHeadingElement>;
  onUpdate: (status: SettableStatus, reason: string) => void;
  onQuick: (action: QuickAction) => void;
  onMessage: () => void;
  onFilterVacancy: (vacancyId: string) => void;
}) {
  const t = useT();
  const p = t.employerApplicationsPage;
  const s = p.sidebar;
  const { locale } = useLocale();
  const l = useHref();
  const statusId = useId();
  const quickId = useId();
  const vacancyId = useId();
  const current = (SETTABLE_STATUSES as readonly string[]).includes(a.status) ? (a.status as SettableStatus) : "";
  const [next, setNext] = useState<SettableStatus | "">(current);
  const [reason, setReason] = useState("");
  // Panel ariza ID'si bo'yicha kalitlanadi (qayta yaratilmaydi) — holat o'zgarsa forma o'zi tozalanadi
  // va fokus yo'qolmaydi (audit R3, gap5-4)
  useEffect(() => {
    setNext((SETTABLE_STATUSES as readonly string[]).includes(a.status) ? (a.status as SettableStatus) : "");
    setReason("");
  }, [a.status]);

  const v = a.vacancy;
  const remote = v.workplaceType === "remote";
  const vacancyRegion = remote ? null : regionLabel(v.region, locale);
  const salary = !v.salaryHidden && (v.salaryMin || v.salaryMax) ? formatSalary(v.salaryMin, v.salaryMax, t.fmt) : null;
  const meta = [
    vacancyRegion && { key: "region", icon: <IconPin size={14} />, label: vacancyRegion },
    v.workplaceType && { key: "workplace", icon: <IconBuilding size={14} />, label: t.enums.workplace[v.workplaceType] },
    v.employmentType && !(remote && v.employmentType === "remote") && { key: "employment", icon: <IconBriefcase size={14} />, label: t.enums.employment[v.employmentType] },
  ].filter((m): m is { key: string; icon: React.ReactElement; label: string } => Boolean(m));
  const publicHref = v.status === "active" && v.slug ? l(`/vacancies/${v.slug}`) : null;
  const vacancyStatus = v.status && v.status !== "active" ? (t.employerVacanciesPage.status as Record<string, string>)[v.status] : null;

  const quick = [
    a.status !== "invited" && { key: "invite" as const, label: s.invite, icon: <IconInterview size={18} />, tone: "text-violet-600 dark:text-violet-300" },
    a.status !== "accepted" && { key: "accept" as const, label: s.accept, icon: <IconCheckCircle size={18} />, tone: "text-growth" },
  ].filter((q): q is { key: "invite" | "accept"; label: string; icon: React.ReactElement; tone: string } => Boolean(q));
  const rowBtn =
    "flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-[14px] font-medium text-ink transition-colors hover:border-signal/40 hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  return (
    <div data-testid="application-sidebar" aria-label={s.label} role="region" className="space-y-5">
      <section aria-labelledby={statusId} className={CARD} data-testid="application-status-card">
        <h2 id={statusId} ref={headingRef} tabIndex={-1} className={`${CARD_TITLE} focus:outline-none focus-visible:ring-2 focus-visible:ring-signal`}>
          {s.statusTitle}
        </h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (next && next !== a.status && !busy) onUpdate(next, reason.trim());
          }}
        >
          <Field id="application-status-select" label={s.statusLabel}>
            <SelectInput
              id="application-status-select"
              value={next}
              options={SETTABLE_STATUSES.map((status) => ({ value: status, label: p.status[status] }))}
              placeholder={a.status === "sent" ? p.status.sent : s.statusPlaceholder}
              placeholderSelectable={false}
              onChange={(value) => setNext(value as SettableStatus)}
            />
          </Field>
          <Field id="application-status-reason" label={s.reasonLabel} hint={s.reasonHint}>
            <TextArea
              id="application-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder={s.reasonPlaceholder}
              aria-describedby="application-status-reason-hint"
              className="min-h-[72px]"
            />
          </Field>
          <button type="submit" disabled={busy || !next || next === a.status} aria-busy={busy || undefined} data-action="update-status" className={`${CTA_PRIMARY} w-full disabled:cursor-not-allowed disabled:opacity-60`}>
            {busy && <Spinner size={16} />}
            {busy ? s.updating : s.update}
          </button>
        </form>
      </section>

      <section aria-labelledby={quickId} className={CARD} data-testid="application-quick-actions">
        <h2 id={quickId} className={CARD_TITLE}>
          {s.quickTitle}
        </h2>
        {gated && <PhoneGateNotice className="mt-3" />}
        <div className="mt-3 space-y-2">
          {quick.map((q) => (
            <button key={q.key} type="button" data-action={q.key} disabled={busy} onClick={() => onQuick(q.key)} className={rowBtn}>
              <span className={`shrink-0 ${q.tone}`}>{q.icon}</span>
              {q.label}
            </button>
          ))}
          <button type="button" data-action="message" disabled={messageBusy} aria-busy={messageBusy || undefined} onClick={onMessage} className={rowBtn}>
            <span className="shrink-0 text-signal dark:text-indigo-300">{messageBusy ? <Spinner size={18} /> : <IconChat size={18} />}</span>
            {messageBusy ? s.messageOpening : s.message}
          </button>
          {a.status !== "rejected" && (
            <div className="border-t border-line pt-2">
              <button
                type="button"
                data-action="reject"
                disabled={busy}
                onClick={() => onQuick("reject")}
                className="flex w-full items-center gap-3 rounded-xl border border-danger/25 bg-danger/[0.04] px-3.5 py-2.5 text-left text-[14px] font-medium text-danger transition-colors hover:border-danger/45 hover:bg-danger/[0.08] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <IconXCircle size={18} className="shrink-0" />
                {s.reject}
              </button>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby={vacancyId} className={CARD} data-testid="application-vacancy">
        <div className="flex items-center justify-between gap-3">
          <h2 id={vacancyId} className={CARD_TITLE}>
            {s.vacancyTitle}
          </h2>
          {publicHref ? (
            <a href={publicHref} data-testid="application-vacancy-link" className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300">
              {s.openVacancy}
              <IconExternal size={14} />
            </a>
          ) : (
            <a href={l(`/employer/vacancies/${v.id}/edit`)} data-testid="application-vacancy-link" className="rounded-md text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300">
              {s.editVacancy}
            </a>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-line bg-surface-2/40 p-3.5">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal dark:text-indigo-300">
              <IconBriefcase size={19} />
            </span>
            <div className="min-w-0">
              <p data-testid="application-vacancy-title" className="text-[14.5px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                {v.title}
              </p>
              {vacancyStatus && <p className="mt-0.5 text-[12px] font-medium uppercase tracking-wide text-dusk">{vacancyStatus}</p>}
            </div>
          </div>
          {meta.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px] text-ink/75">
              {meta.map((m) => (
                <li key={m.key} data-vacancy-meta={m.key} className="inline-flex items-center gap-1.5">
                  <span className="text-dusk">{m.icon}</span>
                  {m.label}
                </li>
              ))}
            </ul>
          )}
          {(salary || v.applicationCount !== null) && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
              {salary && (
                <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-growth">
                  <IconWallet size={14} />
                  {salary}
                </span>
              )}
              {v.applicationCount !== null && (
                <span data-testid="application-vacancy-count" className="inline-flex items-center gap-1.5 text-dusk">
                  <IconUsers size={14} />
                  {s.applications(v.applicationCount)}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onFilterVacancy(v.id)}
          data-action="filter-vacancy"
          className="mt-3 w-full rounded-lg py-1.5 text-center text-[13px] font-semibold text-signal transition-colors hover:bg-signal-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
        >
          {s.onlyThisVacancy}
        </button>
      </section>
    </div>
  );
}
