import React, { useId } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { formatDate, formatSalary } from "../../../lib/format.js";
import { ActionsMenu, type ActionItem } from "../../ActionsMenu.js";
import { regionLabel, vacancyCapabilities, type EmployerVacancyVM } from "../../../lib/employer/vacancies/adapter.js";
import { VacancyStatusBadge } from "./VacancyStatusBadge.js";
import { BTN_OUTLINE, BTN_PRIMARY, BTN_SIGNAL_OUTLINE } from "./styles.js";
import { IconAlert, IconCalendar, IconEye, IconPause, IconPencil, IconPlay, IconTrash, IconUsers, Spinner } from "./icons.js";

/** "UX tadqiqotchi" → "UT". Logo emas — vakansiyaning o'z rasmi bazada yo'q. */
function initials(title: string): string {
  const words = title.replace(/[()«»"“”'’ʻ]/g, " ").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : title.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Vakansiya qatori: chapda nom va ma'lumotlar, o'rtada holat / arizalar / sana,
 * o'ngda holatga mos amallar. Faqat backend beradigan maydonlar — yo'qlari chizilmaydi.
 * Katta ekranda (1280+) bir qator, kichikroqda ustma-ust.
 */
export function VacancyRow({
  vacancy: v,
  busy,
  onStatus,
  onDelete,
}: {
  vacancy: EmployerVacancyVM;
  busy: boolean;
  onStatus: (vacancy: EmployerVacancyVM, next: "active" | "archived") => void;
  onDelete: (vacancy: EmployerVacancyVM) => void;
}) {
  const t = useT();
  const p = t.employerVacanciesPage;
  const { locale } = useLocale();
  const l = useHref();
  const titleId = useId();
  const caps = vacancyCapabilities(v);

  // Hudud · ish joylashuvi · bandlik; masofaviy e'londa hudud va takroriy "Masofaviy" bandlik ko'rsatilmaydi
  const remote = v.workplaceType === "remote";
  const meta = [
    remote ? null : regionLabel(v, locale),
    v.workplaceType ? t.enums.workplace[v.workplaceType] : null,
    v.employmentType && !(remote && v.employmentType === "remote") ? t.enums.employment[v.employmentType] : null,
  ].filter((part): part is string => Boolean(part));
  const hasSalary = v.salaryMin !== null || v.salaryMax !== null;
  const dateIso = v.publishedAt ?? v.createdAt;
  const dateText = dateIso ? formatDate(dateIso, locale) : "";
  const applicationsHref = l(`/employer/applications?vacancy=${encodeURIComponent(v.id)}`);

  const menu: ActionItem[] = [
    ...(caps.viewPublic ? [{ key: "view", label: p.actions.view, icon: <IconEye size={16} />, href: l(`/vacancies/${v.slug}`) }] : []),
    { key: "delete", label: p.actions.delete, icon: <IconTrash size={16} />, tone: "danger" as const, onSelect: () => onDelete(v) },
  ];

  return (
    <li data-vacancy-row={v.id} data-status={v.status} className="xl:col-span-full xl:grid xl:grid-cols-subgrid">
      <article
        aria-labelledby={titleId}
        className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-200 hover:border-signal/30 hover:shadow-card-hover sm:p-5 xl:col-span-full xl:grid xl:grid-cols-subgrid"
      >
        <div className="flex flex-col gap-4 xl:col-span-full xl:grid xl:grid-cols-subgrid xl:items-center xl:gap-x-6">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-2xl bg-signal-soft font-display text-[15px] font-bold tracking-tight text-signal dark:text-indigo-300 sm:h-14 sm:w-14 sm:text-lg"
            >
              {initials(v.title)}
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id={titleId} className="line-clamp-2 font-display text-[15.5px] font-semibold leading-snug text-ink">
                {caps.viewPublic ? (
                  <a href={l(`/vacancies/${v.slug}`)} className="rounded-sm transition-colors hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                    {v.title}
                  </a>
                ) : (
                  v.title
                )}
              </h2>
              {meta.length > 0 && <p className="mt-0.5 truncate text-[13.5px] text-dusk">{meta.join(" · ")}</p>}
              {hasSalary && (
                <p className={`mt-0.5 font-mono text-[13px] ${v.salaryHidden ? "text-dusk" : "text-growth"}`}>{formatSalary(v.salaryMin, v.salaryMax, t.fmt, v.salaryHidden)}</p>
              )}
              {v.rejectionReason && (
                <p data-testid="rejection-reason" className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-danger">
                  <IconAlert size={15} className="mt-px shrink-0" />
                  {t.empVacancies.rejectionReason(v.rejectionReason)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-[62px] sm:pl-[72px] xl:contents">
            <div>
              <VacancyStatusBadge status={v.status} />
            </div>
            <div className="text-[13.5px] text-ink">
              {v.applications !== null &&
                (caps.viewApplications ? (
                  <a
                    href={applicationsHref}
                    data-testid="applications-count"
                    className="inline-flex items-center gap-1.5 rounded-sm font-medium tabular-nums transition-colors hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    <IconUsers size={16} className="text-dusk" />
                    {t.empVacancies.applicationsCount(v.applications)}
                  </a>
                ) : (
                  <span data-testid="applications-count" className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                    <IconUsers size={16} className="text-dusk" />
                    {t.empVacancies.applicationsCount(v.applications)}
                  </span>
                ))}
            </div>
            <div className="text-[13px] text-dusk">
              {dateIso && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={v.publishedAt ? p.published(dateText) : p.created(dateText)}>
                  <IconCalendar size={15} />
                  <span className="sr-only">{v.publishedAt ? p.published(dateText) : p.created(dateText)}</span>
                  <span aria-hidden>{dateText}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
            {caps.viewApplications && (
              // Telefonda alohida to'liq qatorda (tugmalar ikki qatorga sinmasin), sm+ — boshqalar bilan bir qatorda
              <a href={applicationsHref} className={`${BTN_OUTLINE} order-last basis-full sm:order-none sm:basis-auto`}>
                {p.actions.applications}
              </a>
            )}
            <a href={l(`/employer/vacancies/${v.id}/edit`)} className={`${BTN_SIGNAL_OUTLINE} flex-1 sm:flex-none`}>
              <IconPencil size={15} />
              {p.actions.edit}
            </a>
            {caps.close && (
              <button type="button" disabled={busy} aria-busy={busy || undefined} onClick={() => onStatus(v, "archived")} className={`${BTN_OUTLINE} flex-1 sm:flex-none`}>
                {busy ? <Spinner size={15} /> : <IconPause size={14} />}
                {p.actions.close}
              </button>
            )}
            {caps.activate && (
              <button type="button" disabled={busy} aria-busy={busy || undefined} onClick={() => onStatus(v, "active")} className={`${BTN_PRIMARY} flex-1 sm:flex-none`}>
                {busy ? <Spinner size={15} /> : <IconPlay size={14} />}
                {p.actions.activate}
              </button>
            )}
            <ActionsMenu label={p.actions.menu(v.title)} items={menu} />
          </div>
        </div>
      </article>
    </li>
  );
}
