import React, { useId } from "react";
import { useT } from "../../../../lib/i18n/index.js";
import type { EmployerCompanySummary } from "../../../../lib/employer/vacancies/api.js";
import { CompanyLogo } from "../../../companies/CompanyLogo.js";
import { PhoneGateNotice } from "../../../PhoneGateNotice.js";
import { CTA_PRIMARY, CTA_SECONDARY } from "../styles.js";
import type { VacancySummary } from "./useVacancySummary.js";
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconBuilding,
  IconClipboardCheck,
  IconClock,
  IconFile,
  IconLightbulb,
  IconPin,
  IconRefresh,
  IconShield,
  IconSpark,
  IconTarget,
  Spinner,
} from "../icons.js";

const CARD = "rounded-2xl border border-line bg-surface p-5 shadow-xs";
const CARD_TITLE = "font-display text-[16px] font-semibold text-ink";

type Icon = React.ComponentType<{ size?: number; className?: string }>;
const TIP_STYLES: { Icon: Icon; tone: string }[] = [
  { Icon: IconTarget, tone: "bg-signal-soft text-signal dark:text-indigo-300" },
  { Icon: IconClipboardCheck, tone: "bg-surface-2 text-ink/70 ring-1 ring-inset ring-line" },
  { Icon: IconShield, tone: "bg-growth/10 text-growth" },
  { Icon: IconSpark, tone: "bg-gold/15 text-gold-deep" },
];

/** "Foydali maslahatlar" — UX matni (ma'lumot emas). */
export function FormTips() {
  const tips = useT().vacancyForm.tips;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className={`flex items-center gap-2 ${CARD_TITLE}`}>
        <span aria-hidden className="text-gold">
          <IconLightbulb size={20} />
        </span>
        {tips.title}
      </h2>
      <ul className="mt-4 space-y-4">
        {tips.items.map((item, i) => {
          const { Icon, tone } = TIP_STYLES[i % TIP_STYLES.length];
          return (
            <li key={item.title} className="flex gap-3">
              <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold leading-snug text-ink">{item.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-dusk">{item.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Jonli preview — faqat formaga kiritilgan qiymatlar va kompaniya profili.
 * Bo'sh qiymat o'rnida to'qima matn emas, neytral chiziq; "arizalar soni" kabi
 * yangi vakansiyada bo'lmaydigan narsa yo'q.
 */
export function VacancyPreviewCard({
  summary,
  description,
  company,
  onOpen,
}: {
  summary: VacancySummary;
  description: string;
  company: EmployerCompanySummary;
  onOpen: () => void;
}) {
  const t = useT();
  const p = t.vacancyForm.preview;
  const headingId = useId();
  const allChips: { key: string; label: string | null; Icon: Icon }[] = [
    { key: "workplace", label: summary.workplace, Icon: IconBuilding },
    { key: "region", label: summary.region, Icon: IconPin },
    { key: "employment", label: summary.employment, Icon: IconBriefcase },
    { key: "schedule", label: summary.schedule, Icon: IconClock },
  ];
  const chips = allChips.filter((chip): chip is { key: string; label: string; Icon: Icon } => Boolean(chip.label));

  return (
    <section aria-labelledby={headingId} data-testid="vacancy-preview" className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className={CARD_TITLE}>
          {p.title}
        </h2>
        <button
          type="button"
          onClick={onOpen}
          data-action="preview-open"
          className="rounded-md text-[13px] font-semibold text-signal transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
        >
          {p.open}
        </button>
      </div>

      <div role="group" aria-label={p.label} className="mt-4 rounded-xl border border-line bg-paper/70 p-4 dark:bg-surface-2/40">
        <div className="flex items-start gap-3">
          {company.name ? (
            <CompanyLogo name={company.name} src={company.logoUrl} size="sm" />
          ) : (
            <span aria-hidden className="h-10 w-10 shrink-0 rounded-xl bg-line/70" />
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            {summary.title ? (
              <p data-testid="preview-title" className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                {summary.title}
              </p>
            ) : (
              <>
                <span aria-hidden data-testid="preview-title-empty" className="mt-1 block h-3.5 w-3/4 rounded bg-line/80" />
                <span className="sr-only">{p.noTitle}</span>
              </>
            )}
            {company.name && (
              <p data-testid="preview-company" className="mt-1 truncate text-[13px] text-dusk">
                {company.name}
              </p>
            )}
          </div>
        </div>

        {chips.length > 0 && (
          <ul data-testid="preview-chips" className="mt-3 flex flex-wrap gap-1.5">
            {chips.map(({ key, label, Icon: ChipIcon }) => (
              <li key={key} data-chip={key} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink/80">
                <ChipIcon size={13} className="shrink-0 text-dusk" />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
        )}

        {summary.salary ? (
          <p data-testid="preview-salary" className="mt-3 font-mono text-[13.5px] font-semibold text-growth">
            {summary.salary}
          </p>
        ) : summary.salaryHidden ? (
          <p data-testid="preview-salary-hidden" className="mt-3 text-[13px] text-dusk">
            {t.fmt.salaryHidden}
          </p>
        ) : null}

        {description ? (
          <p data-testid="preview-description" className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-dusk [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : (
          <>
            <div aria-hidden className="mt-3 space-y-1.5">
              <span className="block h-2.5 w-full rounded bg-line/60" />
              <span className="block h-2.5 w-2/3 rounded bg-line/60" />
            </div>
            <span className="sr-only">{p.noDescription}</span>
          </>
        )}
      </div>
      {!summary.title && !description && <p className="mt-3 text-[12.5px] leading-relaxed text-dusk">{p.hint}</p>}
    </section>
  );
}

export type SavingIntent = "publish" | "draft";
export interface SaveFailure {
  /** Backend'dan tushunarli xabar (validatsiya / limit); yo'q bo'lsa — umumiy matn. */
  message: string | null;
  /** Tarmoq yoki server xatosi — "Qayta urinish". */
  retry: boolean;
}

const BTN_DRAFT =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-signal/25 bg-signal-soft/60 px-5 text-sm font-semibold text-signal transition-colors hover:border-signal/50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300";

/** "Saqlash va yuborish": tahrirlashda — Ko'rib chiqish / Qoralama / Bekor qilish; ko'rib chiqishda — E'lon qilish / Qoralama / Qaytish. */
export function FormActions({
  mode,
  review,
  saving,
  errorCount,
  failure,
  gated,
  onReview,
  onPublish,
  onDraft,
  onBack,
  onCancel,
  onRetry,
}: {
  mode: "new" | "edit";
  review: boolean;
  saving: SavingIntent | null;
  errorCount: number;
  failure: SaveFailure | null;
  gated: boolean;
  onReview: () => void;
  onPublish: () => void;
  onDraft: () => void;
  onBack: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const f = useT().vacancyForm;
  const a = f.actions;
  const headingId = useId();
  const busy = saving !== null;

  return (
    <section aria-labelledby={headingId} data-testid="vacancy-form-actions" className={CARD}>
      <h2 id={headingId} className={CARD_TITLE}>
        {a.title}
      </h2>

      {errorCount > 0 && (
        <p role="alert" data-testid="vacancy-form-summary" className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-2.5 text-[13px] leading-snug text-danger">
          <IconAlert size={16} className="mt-px shrink-0" />
          {f.errors.summary(errorCount)}
        </p>
      )}
      {gated && <PhoneGateNotice className="mt-3" />}
      {failure && (
        <div role="alert" data-testid="vacancy-form-error" className="mt-3 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3">
          <p className="text-[13.5px] font-semibold text-danger">{f.errors.saveTitle}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink/80 [overflow-wrap:anywhere]">{failure.message ?? f.errors.saveText}</p>
          {failure.retry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              data-action="retry"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-signal hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
            >
              <IconRefresh size={14} />
              {f.errors.retry}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {review ? (
          <button type="button" onClick={onPublish} disabled={busy} aria-busy={saving === "publish" || undefined} data-action="publish" className={`${CTA_PRIMARY} w-full disabled:cursor-not-allowed disabled:opacity-60`}>
            {saving === "publish" && <Spinner size={16} />}
            {saving === "publish" ? (mode === "new" ? a.publishing : a.saving) : mode === "new" ? a.publish : a.saveChanges}
          </button>
        ) : (
          <button type="button" onClick={onReview} disabled={busy} data-action="review" className={`${CTA_PRIMARY} w-full disabled:cursor-not-allowed disabled:opacity-60`}>
            {a.review}
            <IconArrowRight size={16} />
          </button>
        )}
        {mode === "new" && (
          <button type="button" onClick={onDraft} disabled={busy} aria-busy={saving === "draft" || undefined} data-action="draft" className={BTN_DRAFT}>
            {saving === "draft" ? <Spinner size={16} /> : <IconFile size={16} />}
            {saving === "draft" ? a.savingDraft : a.draft}
          </button>
        )}
        {review ? (
          <button type="button" onClick={onBack} disabled={busy} data-action="back" className={`${CTA_SECONDARY} w-full disabled:opacity-60`}>
            <IconArrowLeft size={16} />
            {a.backToEdit}
          </button>
        ) : (
          <button type="button" onClick={onCancel} disabled={busy} data-action="cancel" className={`${CTA_SECONDARY} w-full disabled:opacity-60`}>
            {a.cancel}
          </button>
        )}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-dusk">{mode === "new" ? `${a.publishNote} ${a.draftNote}` : a.editNote}</p>
    </section>
  );
}
