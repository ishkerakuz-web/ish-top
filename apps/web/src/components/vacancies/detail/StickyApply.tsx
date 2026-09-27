import React, { useEffect } from "react";
import type { VacancyDetailVM } from "../../../lib/vacancies/detail.js";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { formatSalary } from "../../../lib/format.js";
import { CompanyLogo } from "../../companies/CompanyLogo.js";
import { needsResume, type ApplyLinks, type ApplyState } from "./ApplyCard.js";
import { IconCheck, Spinner } from "./icons.js";

const BTN =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-4 text-[14px] font-bold text-white transition-colors hover:bg-signal-dark disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Asosiy karta ko'rinmay qolganda chiqadigan ixcham amal (holatga mos). */
function StickyAction({
  vacancy,
  apply,
  links,
  className = "",
}: {
  vacancy: VacancyDetailVM;
  apply: ApplyState;
  links: ApplyLinks;
  className?: string;
}) {
  const d = useT().vacancyDetail.apply;
  const { phase } = apply;

  if (phase.kind === "blocked") return null;
  if (phase.kind === "applied") {
    return (
      <span className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-growth/10 px-3.5 text-[13.5px] font-semibold text-growth ${className}`}>
        <IconCheck size={16} />
        {d.appliedTitle}
      </span>
    );
  }
  if (phase.kind === "guest") {
    return (
      <a href={links.login} className={`${BTN} ${className}`}>
        {d.cta}
      </a>
    );
  }
  if (phase.kind === "ready" && (needsResume(vacancy, apply) || apply.error?.kind === "resume")) {
    return (
      <a href={links.resume} className={`${BTN} ${className}`}>
        {d.fillResume}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void apply.apply()}
      disabled={phase.kind === "loading" || apply.submitting}
      aria-busy={apply.submitting || undefined}
      className={`${BTN} ${className}`}
    >
      {apply.submitting && <Spinner size={16} />}
      {apply.submitting ? d.submitting : d.cta}
    </button>
  );
}

/**
 * Telefon/planshet (< 1024): asosiy ariza kartasi ekrandan chiqsa pastda
 * qotirilgan panel. Ko'ringanda sahifa pastiga joy qo'shiladi (footer yopilmasin).
 */
export function StickyApplyBar({
  visible,
  vacancy,
  apply,
  links,
}: {
  visible: boolean;
  vacancy: VacancyDetailVM;
  apply: ApplyState;
  links: ApplyLinks;
}) {
  const t = useT();
  const { locale } = useLocale();
  const on = visible && apply.phase.kind !== "blocked";
  const salary = vacancy.salary ? formatSalary(vacancy.salary.min, vacancy.salary.max, t.fmt, false, locale) : null;

  useEffect(() => {
    document.body.classList.toggle("has-sticky-cta", on);
    return () => document.body.classList.remove("has-sticky-cta");
  }, [on]);

  return (
    <div
      role="region"
      aria-label={t.vacancyDetail.sticky.label}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 shadow-pop backdrop-blur-xl transition-[transform,opacity,visibility] duration-200 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden ${
        on ? "visible translate-y-0 opacity-100" : "invisible translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{vacancy.title}</p>
          <p className="truncate text-[13px]">
            {salary ? <span className="font-bold tabular-nums text-growth">{salary}</span> : <span className="text-dusk">{vacancy.company.name}</span>}
          </p>
        </div>
        <StickyAction vacancy={vacancy} apply={apply} links={links} />
      </div>
    </div>
  );
}

/** Desktop: yon ustun pastida, ariza kartasi ko'rinmay qolganda yopishib turadigan ixcham karta. */
export function StickyApplyMini({
  visible,
  vacancy,
  apply,
  links,
}: {
  visible: boolean;
  vacancy: VacancyDetailVM;
  apply: ApplyState;
  links: ApplyLinks;
}) {
  const t = useT();
  const { locale } = useLocale();
  const on = visible && apply.phase.kind !== "blocked";
  const salary = vacancy.salary ? formatSalary(vacancy.salary.min, vacancy.salary.max, t.fmt, false, locale) : null;

  return (
    <div className={`sticky top-24 transition-[opacity,visibility] duration-200 ${on ? "visible opacity-100" : "invisible opacity-0"}`}>
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <CompanyLogo name={vacancy.company.name} src={vacancy.company.logoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{vacancy.title}</p>
            <p className="truncate text-[12.5px] text-dusk">{vacancy.company.name}</p>
          </div>
        </div>
        {salary && <p className="mt-2.5 text-[14px] font-bold tabular-nums text-growth">{salary}</p>}
        <StickyAction vacancy={vacancy} apply={apply} links={links} className="mt-3 w-full" />
      </div>
    </div>
  );
}
