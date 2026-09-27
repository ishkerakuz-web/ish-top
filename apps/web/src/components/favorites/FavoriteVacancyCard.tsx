import React, { memo } from "react";
import { absoluteUploadUrl } from "../../lib/api.js";
import type { SavedVacancy } from "../../lib/favorites/adapter.js";
import { formatDate, formatRelativeDays, formatSalary } from "../../lib/format.js";
import { useHref, useLocale, useT } from "../../lib/i18n/index.js";
import { regionName } from "../../lib/i18n/regions.js";
import { ActionsMenu, type ActionItem } from "../ActionsMenu.js";
import { CompanyLogo } from "../companies/CompanyLogo.js";
import {
  EmploymentIcon,
  IconArrowRight,
  IconBookmarkFilled,
  IconBriefcase,
  IconBuilding,
  IconClock,
  IconEye,
  IconPin,
  IconSearch,
  IconVerified,
  IconWallet,
} from "./icons.js";

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border bg-surface px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
const ACCENT = `${BUTTON} border-signal/30 text-signal hover:border-signal hover:bg-signal-soft`;
const NEUTRAL = `${BUTTON} border-line text-ink hover:border-signal/40 hover:text-signal`;

interface Meta {
  key: string;
  icon: React.ReactNode;
  label: string;
}

/**
 * Saqlangan vakansiya kartasi. Ochiq vakansiyada butun karta vakansiya sahifasiga
 * olib boradi (sarlavha havolasi "stretched"); kompaniya, bookmark va amallar uning ustida.
 * Faqat backend'dagi ma'lumot: maosh/hudud/tajriba/ish turi/saqlangan sana bo'lmasa — o'sha qator yo'q.
 * Yopilgan vakansiya: belgi + "O'xshashlarini topish" (vakansiya sahifasi 404).
 */
export const FavoriteVacancyCard = memo(function FavoriteVacancyCard({
  item,
  onRemove,
}: {
  item: SavedVacancy;
  onRemove: (item: SavedVacancy) => void;
}) {
  const t = useT();
  const f = t.favoritesPage;
  const l = useHref();
  const { locale } = useLocale();
  const titleId = `saved-${item.id}-title`;
  const vacancyHref = item.isClosed ? null : l(`/vacancies/${item.slug}`);
  const companyHref = item.company.slug ? l(`/companies/${item.company.slug}`) : null;
  const similarHref = l(`/vacancies?q=${encodeURIComponent(item.title)}`);
  const saved = item.savedAt ? formatRelativeDays(item.savedAt, t.fmt) : null;

  const region = item.region ? (item.region.slug ? regionName(locale, item.region.slug, item.region.name) : item.region.name) : null;
  const salary = item.salary ? formatSalary(item.salary.min, item.salary.max, t.fmt) : null;
  const meta: Meta[] = [];
  if (region) meta.push({ key: "region", icon: <IconPin size={15} />, label: region });
  if (item.experience) meta.push({ key: "experience", icon: <IconClock size={15} />, label: t.enums.experience[item.experience] });
  if (item.employmentType) meta.push({ key: "employment", icon: <EmploymentIcon type={item.employmentType} size={15} />, label: t.enums.employment[item.employmentType] });

  const actions: ActionItem[] = [];
  if (vacancyHref) actions.push({ key: "vacancy", label: f.card.openVacancy, icon: <IconBriefcase size={16} />, href: vacancyHref });
  if (companyHref) actions.push({ key: "company", label: f.card.companyPage, icon: <IconBuilding size={16} />, href: companyHref });
  actions.push({ key: "remove", label: f.card.removeShort, icon: <IconBookmarkFilled size={16} />, onSelect: () => onRemove(item), tone: "danger" });

  const logo = <CompanyLogo name={item.company.name ?? item.title} src={item.company.logoUrl ? absoluteUploadUrl(item.company.logoUrl) : null} size="md" />;

  return (
    <article
      aria-labelledby={titleId}
      // ⋮ menyu ochiq bo'lsa karta qo'shni kartalar ustiga chiqadi — menyu keyingi kartaning ostida qolmasin
      className={`group relative rounded-3xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200 has-[button[aria-haspopup=menu][aria-expanded=true]]:z-30 sm:p-5 ${
        item.isClosed ? "" : "hover:border-signal/30 hover:shadow-card-hover"
      }`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 sm:gap-x-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-5">
        <div className="row-start-1 md:row-span-2">
          {companyHref ? (
            // Takroriy havola — klaviatura va ekran o'quvchi kompaniya nomidagi havoladan foydalanadi
            <a href={companyHref} tabIndex={-1} aria-hidden className={`relative z-10 block h-fit ${item.isClosed ? "opacity-70" : ""}`}>
              {logo}
            </a>
          ) : (
            <span className={item.isClosed ? "block opacity-70" : "block"}>{logo}</span>
          )}
        </div>

        <div className="col-start-2 row-start-1 min-w-0 md:row-span-2">
          <h3 id={titleId} className={`font-display text-[16px] font-bold leading-snug tracking-tight sm:text-[17px] ${item.isClosed ? "text-ink/70" : "text-ink"}`}>
            {vacancyHref ? (
              <a
                href={vacancyHref}
                className="transition-colors after:absolute after:inset-0 after:rounded-3xl after:content-[''] hover:text-signal focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-signal"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>

          {item.company.name && (
            <p className="mt-0.5 text-[14px] text-dusk">
              {companyHref ? (
                <a
                  href={companyHref}
                  className="relative z-10 inline-flex items-center gap-1 font-medium text-ink/80 transition-colors hover:text-signal hover:underline"
                >
                  {item.company.name}
                  {item.company.isVerified && (
                    <span className="text-signal">
                      <IconVerified size={15} />
                      <span className="sr-only">{f.card.verified}</span>
                    </span>
                  )}
                </a>
              ) : (
                <span className="font-medium text-ink/80">{item.company.name}</span>
              )}
            </p>
          )}

          {(salary || meta.length > 0) && (
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-dusk">
              {salary && (
                <li className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-semibold ${item.isClosed ? "text-ink/60" : "text-growth"}`}>
                  <IconWallet size={15} />
                  {salary}
                </li>
              )}
              {meta.map((m) => (
                <li key={m.key} className="inline-flex items-center gap-1.5">
                  <span className="text-dusk/80">{m.icon}</span>
                  {m.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {(saved || item.isClosed) && (
          <div className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-3 md:row-start-1 md:justify-self-end">
            {item.isClosed && <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[12px] font-semibold text-danger">{f.card.closed}</span>}
            {saved && item.savedAt && (
              <time dateTime={item.savedAt} title={formatDate(item.savedAt, locale)} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-dusk">
                {f.card.savedAgo(saved)}
              </time>
            )}
          </div>
        )}

        <div className="relative z-10 col-span-2 flex items-center gap-2 border-t border-line pt-3.5 md:col-span-1 md:col-start-3 md:row-start-2 md:justify-self-end md:border-0 md:pt-0">
          <button
            type="button"
            aria-pressed="true"
            aria-label={f.card.remove(item.title)}
            title={f.card.removeShort}
            onClick={() => onRemove(item)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-signal/30 bg-signal-soft text-signal transition-colors hover:border-signal hover:bg-signal hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconBookmarkFilled size={18} />
          </button>
          {vacancyHref ? (
            <a href={vacancyHref} aria-describedby={titleId} className={`${ACCENT} flex-1 md:flex-none`}>
              <IconEye size={16} />
              {f.card.viewVacancy}
              <IconArrowRight size={15} />
            </a>
          ) : (
            <a href={similarHref} aria-describedby={titleId} className={`${NEUTRAL} flex-1 md:flex-none`}>
              <IconSearch size={15} />
              {f.card.findSimilar}
            </a>
          )}
          <ActionsMenu label={f.card.actions(item.title)} items={actions} />
        </div>
      </div>
    </article>
  );
});
