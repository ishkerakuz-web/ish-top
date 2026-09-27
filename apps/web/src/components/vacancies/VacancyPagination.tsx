import React, { useId } from "react";
import { useT } from "../../lib/i18n/index.js";
import { PAGE_SIZES } from "../../lib/vacancies/query.js";
import { FieldSelect } from "./FieldSelect.js";
import { IconChevronLeft, IconChevronRight } from "./icons.js";

/** 1 2 3 4 5 … 8 · 1 … 4 5 6 … 8 · 1 … 4 5 6 7 8 — uzunligi barqaror, sakramaydi. */
export function pageItems(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  let start = Math.max(2, current - 1);
  let end = Math.min(count - 1, current + 1);
  if (current <= 3) {
    start = 2;
    end = 5;
  } else if (current >= count - 2) {
    start = count - 4;
    end = count - 1;
  }
  const items: (number | "gap")[] = [1];
  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < count - 1) items.push("gap");
  items.push(count);
  return items;
}

/**
 * Sahifalash — backend'dagi mavjud `page`/`pageSize` bilan. Raqamlar haqiqiy
 * havolalar (yangi tabda ochiladi, qidiruv tizimi ko'radi); oddiy bosishda
 * sahifa qayta yuklanmaydi.
 */
export function VacancyPagination({
  page,
  pageCount,
  total,
  size,
  hrefFor,
  onPage,
  onSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  size: number;
  hrefFor: (page: number) => string;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const p = useT().vacanciesPage.pagination;
  const id = useId();
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  const go = (target: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onPage(target);
  };

  const box =
    "flex h-9 min-w-[36px] items-center justify-center rounded-xl border px-2 text-[13.5px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  return (
    <nav aria-label={p.label} className="mt-6 grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
      <p className="order-3 text-center text-[13px] tabular-nums text-dusk sm:order-1 sm:text-left">{p.range(from, to, total)}</p>

      {pageCount > 1 ? (
        <ul className="order-1 flex flex-wrap items-center justify-center gap-1.5 sm:order-2">
          <li>
            {page > 1 ? (
              <a href={hrefFor(page - 1)} onClick={go(page - 1)} aria-label={p.prev} className={`${box} border-line bg-surface text-ink hover:border-signal hover:text-signal`}>
                <IconChevronLeft size={16} />
              </a>
            ) : (
              <span aria-hidden className={`${box} border-line bg-surface text-dusk/50`}>
                <IconChevronLeft size={16} />
              </span>
            )}
          </li>
          {pageItems(page, pageCount).map((item, i) =>
            item === "gap" ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-dusk">
                …
              </li>
            ) : (
              <li key={item}>
                <a
                  href={hrefFor(item)}
                  onClick={go(item)}
                  aria-label={p.page(item)}
                  aria-current={item === page ? "page" : undefined}
                  className={`${box} ${
                    item === page ? "border-signal bg-signal text-white shadow-xs" : "border-line bg-surface text-ink hover:border-signal hover:text-signal"
                  }`}
                >
                  {item}
                </a>
              </li>
            )
          )}
          <li>
            {page < pageCount ? (
              <a href={hrefFor(page + 1)} onClick={go(page + 1)} aria-label={p.next} className={`${box} border-line bg-surface text-ink hover:border-signal hover:text-signal`}>
                <IconChevronRight size={16} />
              </a>
            ) : (
              <span aria-hidden className={`${box} border-line bg-surface text-dusk/50`}>
                <IconChevronRight size={16} />
              </span>
            )}
          </li>
        </ul>
      ) : (
        <span className="order-1 hidden sm:order-2 sm:block" />
      )}

      <div className="order-2 flex items-center justify-center gap-2 sm:order-3 sm:justify-end">
        <span className="text-[13px] text-dusk" aria-hidden>
          {p.perPage}:
        </span>
        <FieldSelect
          id={`${id}-size`}
          label={p.perPage}
          size="sm"
          className="w-[84px]"
          value={String(size)}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
          onChange={(value) => onSize(Number(value))}
        />
      </div>
    </nav>
  );
}
