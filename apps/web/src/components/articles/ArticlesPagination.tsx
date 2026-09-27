import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { pageItems } from "../vacancies/VacancyPagination.js";
import { IconChevronLeft, IconChevronRight } from "./icons.js";

/** Sahifa raqamlari — haqiqiy havolalar; bitta sahifa bo'lsa umuman chizilmaydi. */
export function ArticlesPagination({
  page,
  pageCount,
  hrefFor,
  onPage,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  onPage: (page: number) => void;
}) {
  const p = useT().articles.pagination;
  if (pageCount <= 1) return null;

  const go = (target: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onPage(target);
  };
  const box =
    "flex h-10 min-w-[40px] items-center justify-center rounded-xl border px-2 text-[14px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
  const idle = `${box} border-line bg-surface text-ink hover:border-signal hover:text-signal`;
  const disabled = `${box} border-line bg-surface text-dusk/50`;

  return (
    <nav aria-label={p.label} className="mt-10 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <a href={hrefFor(page - 1)} onClick={go(page - 1)} aria-label={p.prev} className={idle}>
              <IconChevronLeft size={16} />
            </a>
          ) : (
            <span aria-hidden className={disabled}>
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
            <span aria-hidden className={disabled}>
              <IconChevronRight size={16} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
