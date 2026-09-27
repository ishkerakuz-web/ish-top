import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { SALARY_ROLES, type SalaryRole } from "../../lib/salaries/query.js";
import { IconChevronRight } from "./icons.js";

const chip = (active: boolean) =>
  `inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
    active
      ? "border-signal bg-signal text-white shadow-xs"
      : "border-line bg-surface text-ink/80 hover:border-signal/40 hover:text-ink"
  }`;

/**
 * Ommabop kasblar. Bosilgani qidiruv maydoniga ham tushadi; qayta bosilsa —
 * bekor qilinadi. Sig'masa gorizontal aylanadi (o'ngda strelka, sm+).
 */
export function PopularRoles({ active, onSelect }: { active: SalaryRole | ""; onSelect: (role: SalaryRole | "") => void }) {
  const s = useT().salaries;
  const labelId = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (rail) setMore(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    rail.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      rail.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Tanlangan kasb lentaning ko'rinmas qismida (yoki strelka ostida) qolib ketmasin
  useEffect(() => {
    const rail = railRef.current;
    const chipEl = rail?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!rail || !chipEl) return;
    const r = rail.getBoundingClientRect();
    const b = chipEl.getBoundingClientRect();
    // 88 = o'ngdagi xiralashish (w-20) + bo'shliq
    if (b.right > r.right - 88) rail.scrollLeft += b.right - r.right + 88;
    else if (b.left < r.left) rail.scrollLeft -= r.left - b.left + 16;
    measure();
  }, [active, measure]);

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span id={labelId} className="shrink-0 text-[13.5px] font-medium text-dusk">
        {s.popular.label}:
      </span>
      <div className="relative min-w-0 flex-1">
        <div
          ref={railRef}
          role="group"
          aria-labelledby={labelId}
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0 sm:pr-10"
        >
          {SALARY_ROLES.map((role) => {
            const on = role === active;
            return (
              <button key={role} type="button" aria-pressed={on} onClick={() => onSelect(on ? "" : role)} className={chip(on)}>
                {s.roles[role].label}
              </button>
            );
          })}
        </div>
        {more && (
          <>
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-20 bg-gradient-to-l from-paper via-paper/80 to-transparent sm:block" />
            <button
              type="button"
              onClick={() => railRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
              aria-label={s.popular.more}
              className="absolute right-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:border-signal hover:text-signal sm:flex"
            >
              <IconChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
