import React, { memo } from "react";
import { absoluteUploadUrl } from "../../lib/api.js";
import { formatDate, formatRelativeDays, formatSalary } from "../../lib/format.js";
import { useHref, useLocale, useT } from "../../lib/i18n/index.js";
import { regionName } from "../../lib/i18n/regions.js";
import type { ApplicationStatus, MyApplication } from "../../lib/types.js";
import { CompanyLogo } from "../companies/CompanyLogo.js";
import { ApplicationActionsMenu } from "./ApplicationActionsMenu.js";
import { ApplicationNextAction } from "./ApplicationNextAction.js";
import { ApplicationStatusBadge } from "./ApplicationStatus.js";
import { IconArrowRight, IconBriefcase, IconClock, IconFile, IconPin, IconVerified, IconWallet } from "./icons.js";

interface MetaItem {
  key: string;
  icon: React.ReactNode;
  label: string;
}

/** Vakansiya meta qatorlari — faqat backend'da bor ma'lumot (bo'sh qator chizilmaydi). */
export function useApplicationMeta(app: MyApplication): { region: string | null; salary: string | null; meta: MetaItem[] } {
  const t = useT();
  const { locale } = useLocale();
  const v = app.vacancy;
  const region = v.regionSlug ? regionName(locale, v.regionSlug, v.regionName) : v.regionName;
  const salary = !v.isSalaryHidden && (v.salaryMin || v.salaryMax) ? formatSalary(v.salaryMin, v.salaryMax, t.fmt) : null;
  const meta: MetaItem[] = [];
  if (region) meta.push({ key: "region", icon: <IconPin size={15} />, label: region });
  if (salary) meta.push({ key: "salary", icon: <IconWallet size={15} />, label: salary });
  if (v.employmentType) meta.push({ key: "employment", icon: <IconBriefcase size={15} />, label: t.enums.employment[v.employmentType] });
  if (v.experienceRequired) meta.push({ key: "experience", icon: <IconClock size={15} />, label: t.enums.experience[v.experienceRequired] });
  return { region, salary, meta };
}

/** Suhbat va yakuniy holatlarda asosiy tugma tafsilotni ochadi (tarix, rezyume, xabarlar). */
const DETAIL_FIRST: ReadonlySet<ApplicationStatus> = new Set(["invited", "accepted", "rejected"]);

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border bg-surface px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
const NEUTRAL = `${BUTTON} border-line text-ink hover:border-signal/40 hover:text-signal`;
const ACCENT = `${BUTTON} border-signal/30 text-signal hover:border-signal hover:bg-signal-soft`;

/**
 * Ariza kartasi. Butun karta tafsilotni ochadi (sarlavha tugmasi "stretched");
 * kompaniya havolasi va amallar uning ustida (`relative z-10`).
 * Vakansiya → `/vacancies/:slug`, kompaniya → `/companies/:slug` (employer route emas).
 *
 * Joylashuv: telefon — ustma-ust; md — ma'lumot | tugmalar; xl — ma'lumot | holat | tugmalar.
 * Pastda holatga mos "keyingi qadam" satri.
 */
export const ApplicationCard = memo(function ApplicationCard({
  app,
  onOpen,
}: {
  app: MyApplication;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const a = t.applicationsPage;
  const l = useHref();
  const { locale } = useLocale();
  const { meta } = useApplicationMeta(app);
  const v = app.vacancy;
  const c = app.company;
  const titleId = `application-${app.id}-title`;
  const vacancyHref = v.isClosed ? null : l(`/vacancies/${v.slug}`);
  const companyHref = c.slug ? l(`/companies/${c.slug}`) : null;
  const relative = formatRelativeDays(app.createdAt, t.fmt);
  const logo = <CompanyLogo name={c.name || v.title} src={c.logoUrl ? absoluteUploadUrl(c.logoUrl) : null} size="md" />;
  const open = () => onOpen(app.id);

  let primary: React.ReactNode;
  if (DETAIL_FIRST.has(app.status)) {
    primary = (
      <button type="button" onClick={open} aria-haspopup="dialog" aria-describedby={titleId} className={`${ACCENT} flex-1 md:flex-none`}>
        {a.card.viewDetails}
        <IconArrowRight size={15} />
      </button>
    );
  } else if (vacancyHref) {
    primary = (
      <a href={vacancyHref} aria-describedby={titleId} className={`${NEUTRAL} flex-1 md:flex-none`}>
        {a.card.viewVacancy}
        <IconArrowRight size={15} />
      </a>
    );
  } else {
    primary = (
      <button type="button" onClick={open} aria-haspopup="dialog" aria-describedby={titleId} className={`${NEUTRAL} flex-1 md:flex-none`}>
        <IconFile size={15} />
        {a.card.viewApplication}
      </button>
    );
  }

  return (
    <article
      aria-labelledby={titleId}
      // ⋮ menyu ochiq bo'lsa karta qo'shni kartalar ustiga chiqadi — menyu keyingi kartaning ostida qolmasin
      className="group relative rounded-3xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-signal/30 hover:shadow-card-hover has-[button[aria-haspopup=menu][aria-expanded=true]]:z-30 sm:p-5"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 sm:gap-x-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-5 xl:grid-cols-[auto_minmax(0,1fr)_minmax(150px,auto)_auto]">
        <div className="row-start-1 md:row-span-2 xl:row-span-1">
          {companyHref ? (
            // Takroriy havola — klaviatura va ekran o'quvchi kompaniya nomidagi havoladan foydalanadi
            <a href={companyHref} tabIndex={-1} aria-hidden className="relative z-10 block h-fit">
              {logo}
            </a>
          ) : (
            logo
          )}
        </div>

        <div className="col-start-2 row-start-1 min-w-0">
          <h3 id={titleId} className="font-display text-[16px] font-bold leading-snug tracking-tight text-ink sm:text-[17px]">
            <button
              type="button"
              onClick={open}
              aria-haspopup="dialog"
              className="text-left transition-colors after:absolute after:inset-0 after:rounded-3xl after:content-[''] hover:text-signal focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-signal"
            >
              {v.title}
            </button>
          </h3>

          {c.name && (
            <p className="mt-0.5 text-[14px] text-dusk">
              {companyHref ? (
                <a
                  href={companyHref}
                  className="relative z-10 inline-flex items-center gap-1 font-medium text-ink/80 transition-colors hover:text-signal hover:underline"
                >
                  {c.name}
                  {c.isVerified && (
                    <span className="text-signal">
                      <IconVerified size={15} />
                      <span className="sr-only">{a.card.verified}</span>
                    </span>
                  )}
                </a>
              ) : (
                <span className="font-medium text-ink/80">{c.name}</span>
              )}
            </p>
          )}

          {meta.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-dusk">
              {meta.map((m) => (
                <li key={m.key} className={`inline-flex items-center gap-1.5 ${m.key === "salary" ? "font-semibold text-ink/85" : ""}`}>
                  <span className="text-dusk/80">{m.icon}</span>
                  {m.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-start-2 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 xl:col-start-3 xl:row-start-1 xl:flex-col xl:items-start xl:justify-center xl:gap-y-2">
          <ApplicationStatusBadge status={app.status} />
          {relative && (
            <time dateTime={app.createdAt} title={formatDate(app.createdAt, locale)} className="inline-flex items-center gap-1 text-[12.5px] text-dusk">
              <IconClock size={13} />
              {relative}
            </time>
          )}
          {v.isClosed && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-dusk">{a.card.closed}</span>}
        </div>

        <div className="relative z-10 col-span-2 row-start-3 flex items-center gap-2 border-t border-line pt-3.5 md:col-span-1 md:col-start-3 md:row-span-2 md:row-start-1 md:self-center md:border-0 md:pt-0 xl:col-start-4 xl:row-span-1">
          {primary}
          <ApplicationActionsMenu title={v.title} onOpen={open} vacancyHref={vacancyHref} companyHref={companyHref} />
        </div>
      </div>

      <div className="mt-3.5">
        <ApplicationNextAction status={app.status} />
      </div>
    </article>
  );
});
