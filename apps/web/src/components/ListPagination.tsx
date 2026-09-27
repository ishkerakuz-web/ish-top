import React, { useId } from "react";
import { PAGE_SIZES, type PageSize } from "../lib/list.js";
import { IconChevronLeft, IconChevronRight } from "./companies/icons.js";
import { FieldSelect } from "./vacancies/FieldSelect.js";
import { pageItems } from "./vacancies/VacancyPagination.js";

export interface PaginationLabels {
  label: string;
  prev: string;
  next: string;
  page: (n: number) => string;
  range: (from: number, to: number, total: number) => string;
  perPage: string;
  perPageOption: (n: number) => string;
}

export interface ListPaginationProps {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  size: PageSize;
  hrefFor: (page: number) => string;
  onPage: (page: number) => void;
  onSize: (size: PageSize) => void;
}

/**
 * Klient tomonidagi ro'yxat sahifalashi (arizalar, saqlanganlar): "N tadan a–b",
 * sahifa raqamlari (haqiqiy havolalar — yangi tabda ochiladi, oddiy bosishda
 * sahifa qayta yuklanmaydi) va "Sahifadagi" tanlovi. Bitta sahifa bo'lsa raqamlar chizilmaydi.
 */
export function ListPagination({ labels: p, page, pageCount, from, to, total, size, hrefFor, onPage, onSize }: ListPaginationProps & { labels: PaginationLabels }) {
  const id = useId();

  const go = (target: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onPage(target);
  };

  const box =
    "flex h-9 min-w-[36px] items-center justify-center rounded-xl border px-2 text-[13.5px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
  const idle = `${box} border-line bg-surface text-ink hover:border-signal hover:text-signal`;

  return (
    <div className="mt-5 flex flex-col items-center gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <p className="text-center text-[13px] tabular-nums text-dusk sm:justify-self-start sm:text-left">{p.range(from, to, total)}</p>

      {pageCount > 1 ? (
        <nav aria-label={p.label}>
          <ul className="flex flex-wrap items-center justify-center gap-1.5">
            <li>
              {page > 1 ? (
                <a href={hrefFor(page - 1)} onClick={go(page - 1)} aria-label={p.prev} className={idle}>
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
                    className={item === page ? `${box} border-signal bg-signal text-white shadow-xs` : idle}
                  >
                    {item}
                  </a>
                </li>
              )
            )}
            <li>
              {page < pageCount ? (
                <a href={hrefFor(page + 1)} onClick={go(page + 1)} aria-label={p.next} className={idle}>
                  <IconChevronRight size={16} />
                </a>
              ) : (
                <span aria-hidden className={`${box} border-line bg-surface text-dusk/50`}>
                  <IconChevronRight size={16} />
                </span>
              )}
            </li>
          </ul>
        </nav>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}

      <div className="flex items-center gap-2 sm:justify-self-end">
        <span aria-hidden className="text-[13px] text-dusk">
          {p.perPage}:
        </span>
        <FieldSelect
          id={`${id}-size`}
          label={p.perPage}
          size="sm"
          value={String(size)}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: p.perPageOption(n) }))}
          onChange={(value) => onSize(Number(value) as PageSize)}
          className="w-[96px]"
        />
      </div>
    </div>
  );
}
