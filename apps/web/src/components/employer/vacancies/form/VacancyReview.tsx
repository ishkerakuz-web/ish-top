import React, { useId } from "react";
import { useT } from "../../../../lib/i18n/index.js";
import { toItems } from "../../../../lib/vacancies/detail.js";
import type { EmployerCompanySummary } from "../../../../lib/employer/vacancies/api.js";
import type { VacancyFormValues } from "../../../../lib/employer/vacancies/form.js";
import { CompanyLogo } from "../../../companies/CompanyLogo.js";
import { SECTION_TITLE, VacancyDescription } from "../../../vacancies/detail/VacancyDescription.js";
import { BTN_SIGNAL_OUTLINE } from "../styles.js";
import type { VacancySummary } from "./useVacancySummary.js";
import { IconCheckCircle, IconEye, IconMail, IconPencil, IconPhone, IconTelegram } from "../icons.js";

function ReviewList({ title, items, testId }: { title: string; items: string[]; testId: string }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-testid={testId}>
      <h2 id={headingId} className={SECTION_TITLE}>
        {title}
      </h2>
      <ul className="mt-3 space-y-2 text-[15px] leading-[1.75] text-ink/80">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 4-bosqich — "Ko'rib chiqish": vakansiya sahifasi bilan bir xil ko'rinish
 * (tavsif `parseRichText`, talablar/sharoitlar — qator = band). Faqat to'ldirilgan qismlar.
 */
export function VacancyReview({
  mode,
  values,
  summary,
  company,
  headingRef,
  onEdit,
}: {
  mode: "new" | "edit";
  values: VacancyFormValues;
  summary: VacancySummary;
  company: EmployerCompanySummary;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onEdit: () => void;
}) {
  const t = useT();
  const r = t.vacancyForm.review;
  const d = t.vacancyDetail;
  const headingId = useId();
  const requirements = toItems(values.requirements);
  const conditions = toItems(values.conditions);
  const facts = [
    { key: "category", label: t.vacancyForm.fields.category, value: summary.category },
    { key: "workplace", label: d.workplace, value: summary.workplace },
    { key: "region", label: d.location, value: summary.region },
    { key: "employment", label: d.employment, value: summary.employment },
    { key: "schedule", label: d.schedule, value: summary.schedule },
    { key: "experience", label: d.experience, value: summary.experience },
  ].filter((fact): fact is { key: string; label: string; value: string } => Boolean(fact.value));
  const telegram = values.contactTelegram.trim().replace(/^@+/, "");
  const contacts = [
    { key: "email", value: values.contactEmail.trim(), Icon: IconMail },
    { key: "telegram", value: telegram ? `@${telegram}` : "", Icon: IconTelegram },
    { key: "phone", value: values.contactPhone.trim(), Icon: IconPhone },
  ].filter((c) => c.value);

  return (
    <section aria-labelledby={headingId} data-testid="vacancy-review" className="rounded-2xl border border-line bg-surface shadow-xs">
      <header className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal dark:text-indigo-300">
            <IconEye size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={headingId} ref={headingRef} tabIndex={-1} className="font-display text-[17px] font-semibold leading-snug text-ink focus:outline-none">
              {r.title}
            </h2>
            <p className="mt-0.5 text-[13.5px] leading-snug text-dusk">{mode === "new" ? r.subtitle : r.subtitleEdit}</p>
          </div>
        </div>
        <button type="button" onClick={onEdit} data-action="review-edit" className={`${BTN_SIGNAL_OUTLINE} self-start`}>
          <IconPencil size={15} />
          {r.edit}
        </button>
      </header>

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {company.name && <CompanyLogo name={company.name} src={company.logoUrl} size="md" />}
          <div className="min-w-0">
            <h3 data-testid="review-title" className="font-display text-[22px] font-bold leading-tight tracking-tight text-ink [overflow-wrap:anywhere] sm:text-[26px]">
              {summary.title}
            </h3>
            {company.name && <p className="mt-1 text-[14px] text-dusk">{company.name}</p>}
          </div>
        </div>

        {summary.salary ? (
          <p data-testid="review-salary" className="mt-4 font-display text-[20px] font-bold tabular-nums text-ink">
            {summary.salary}
          </p>
        ) : summary.salaryHidden ? (
          <p className="mt-4 text-[14px] text-dusk">{t.fmt.salaryHidden}</p>
        ) : null}

        {facts.length > 0 && (
          <dl aria-label={r.details} className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.key} data-fact={fact.key} className="rounded-xl border border-line bg-surface-2/50 px-3.5 py-2.5">
                <dt className="text-[12px] text-dusk">{fact.label}</dt>
                <dd className="mt-0.5 text-[14px] font-medium text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-7 space-y-7">
          <VacancyDescription text={values.description.trim()} title={r.about} />
          {requirements.length > 0 && <ReviewList title={r.requirements} items={requirements} testId="review-requirements" />}
          {conditions.length > 0 && <ReviewList title={r.conditions} items={conditions} testId="review-conditions" />}
          {values.applyWithoutResume && (
            <p className="flex items-center gap-2 rounded-xl bg-growth/[0.07] px-3.5 py-2.5 text-[14px] text-ink">
              <IconCheckCircle size={18} className="shrink-0 text-growth" />
              {r.withoutResume}
            </p>
          )}
          {contacts.length > 0 && (
            <section data-testid="review-contacts">
              <h2 className={SECTION_TITLE}>{r.contacts}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {contacts.map(({ key, value, Icon }) => (
                  <li key={key} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink">
                    <Icon size={16} className="shrink-0 text-dusk" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{value}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
