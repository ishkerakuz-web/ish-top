import React, { useId, useState } from "react";
import type { CompanyDetailVM } from "../../../lib/companies/detail.js";
import { useT } from "../../../lib/i18n/index.js";
import { CARD, CARD_TITLE } from "./styles.js";
import { IconBuilding, IconCalendar, IconGlobe, IconUsers } from "./icons.js";

const LONG_CHARS = 420;
const LONG_LINES = 5;

// Tor telefonda (< 400px) bitta ustun — qiymat va yozuv kesilmasin
const STAT_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 min-[400px]:grid-cols-2",
  3: "grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4",
};

/**
 * Asosiy ko'rsatkichlar — faqat mavjud ma'lumot uchun karta (1–4 ta), panjara
 * soniga moslashadi. "Mamlakat" faqat hudud bor bo'lsa (hududlar — O'zbekiston).
 */
export function CompanyStats({ company }: { company: CompanyDetailVM }) {
  const d = useT().companyDetail;
  const items: { key: string; icon: React.ReactNode; value: string; label: string }[] = [];
  if (company.employeeCount) items.push({ key: "employees", icon: <IconUsers size={22} />, value: company.employeeCount, label: d.stats.employees });
  if (company.foundedYear) items.push({ key: "founded", icon: <IconCalendar size={22} />, value: String(company.foundedYear), label: d.stats.founded });
  if (company.industries[0]) items.push({ key: "industry", icon: <IconBuilding size={22} />, value: company.industries[0], label: d.stats.industry });
  if (company.regionName) items.push({ key: "country", icon: <IconGlobe size={22} />, value: d.country, label: d.stats.country });
  if (items.length === 0) return null;

  return (
    <dl aria-label={d.stats.label} className={`grid gap-3 ${STAT_GRID[items.length]}`}>
      {/* audit R3, a11y-ui (axe definition-list/dlitem): <dt>/<dd> <dl> ning
          bevosita bolasi yoki BITTA <div> ichida bo'lishi kerak edi — ikkita
          div ichida edi. Endi bitta grid: ikonka chapda, qiymat tepada,
          yozuv pastda (DOM tartibi dt → dd, ko'rinish o'zgarmaydi). */}
      {items.map((item) => (
        <div
          key={item.key}
          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 rounded-2xl border border-line bg-surface p-3.5"
        >
          <span aria-hidden className="row-span-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
            {item.icon}
          </span>
          <dt className="col-start-2 row-start-2 text-[12.5px] leading-snug text-dusk [overflow-wrap:anywhere]">{item.label}</dt>
          <dd className="col-start-2 row-start-1 font-display text-[17px] font-bold leading-snug text-ink [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function hasStats(company: CompanyDetailVM): boolean {
  return Boolean(company.employeeCount || company.foundedYear || company.industries.length || company.regionName);
}

/**
 * "Kompaniya haqida" + ko'rsatkichlar bitta kartada. Tavsif uzun bo'lsa
 * "Ko'proq o'qish". Tavsif yo'q — faqat ko'rsatkichlar; ikkalasi ham yo'q — karta yo'q.
 */
export function CompanyOverview({ company }: { company: CompanyDetailVM }) {
  const d = useT().companyDetail;
  const headingId = useId();
  const textId = useId();
  const [open, setOpen] = useState(false);
  const text = company.description;
  const stats = hasStats(company);
  if (!text && !stats) return null;

  const long = Boolean(text && (text.length > LONG_CHARS || text.split("\n").length > LONG_LINES));

  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className={text ? CARD_TITLE : "sr-only"}>
        {text ? d.about.title : d.stats.label}
      </h2>
      {text && (
        <>
          <p
            id={textId}
            className={`mt-3 whitespace-pre-line text-[15px] leading-[1.75] text-ink/80 [overflow-wrap:anywhere] ${long && !open ? "line-clamp-4" : ""}`}
          >
            {text}
          </p>
          {long && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={textId}
              onClick={() => setOpen((v) => !v)}
              className="mt-2 rounded-md text-[14px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {open ? d.about.less : d.about.more}
            </button>
          )}
        </>
      )}
      {stats && (
        <div className={text ? "mt-5" : ""}>
          <CompanyStats company={company} />
        </div>
      )}
    </section>
  );
}
