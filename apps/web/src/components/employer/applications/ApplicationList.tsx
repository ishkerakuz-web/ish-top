import React, { memo } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { formatRelativeDays } from "../../../lib/format.js";
import type { EmployerApplicationVM } from "../../../lib/employer/applications/adapter.js";
import type { PageSlice } from "../../../lib/list.js";
import { pageItems } from "../../vacancies/VacancyPagination.js";
import { ApplicationStatusPill } from "./ApplicationStatusPill.js";
import { CandidateAvatar } from "./CandidateAvatar.js";
import { IconBriefcase, IconChevronLeft, IconChevronRight } from "./icons.js";

const ApplicationRow = memo(function ApplicationRow({
  application: a,
  selected,
  href,
  onSelect,
}: {
  application: EmployerApplicationVM;
  selected: boolean;
  href: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const p = t.employerApplicationsPage;
  const posted = formatRelativeDays(a.createdAt, t.fmt);
  return (
    <a
      href={href}
      data-application-row={a.id}
      data-status={a.status}
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onSelect(a.id);
      }}
      className={`relative flex gap-3 px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${
        selected ? "bg-signal-soft/60 dark:bg-signal-soft/30" : "hover:bg-surface-2/70"
      }`}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-signal" />}
      <CandidateAvatar name={a.candidate.name} src={a.candidate.avatarUrl} size="sm" dot={a.status === "sent"} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[14.5px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{a.candidate.name}</span>
        {a.candidate.headline && <span className="mt-0.5 block truncate text-[13px] text-dusk">{a.candidate.headline}</span>}
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink/70">
          <IconBriefcase size={13} className="shrink-0 text-dusk" />
          <span className="truncate">{a.vacancy.title}</span>
        </span>
        {/* Holat pastki qatorda — uzun holat nomi nomzod ismini qirqmasin */}
        <span className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[12px] text-dusk" suppressHydrationWarning>
            {posted}
          </span>
          <ApplicationStatusPill status={a.status} size="sm" />
        </span>
        {a.status === "sent" && <span className="sr-only">{p.newMark}</span>}
      </span>
    </a>
  );
});

/**
 * Chap panel — arizalar (joriy sahifa) va ixcham sahifalash. Har bir qator — ariza:
 * nomzod + qaysi vakansiyaga + qachon + holat. Qator haqiqiy havola (`?application=`).
 */
export function ApplicationList({
  items,
  slice,
  total,
  selectedId,
  hrefFor,
  pageHref,
  onSelect,
  onPage,
}: {
  items: EmployerApplicationVM[];
  slice: Pick<PageSlice<EmployerApplicationVM>, "page" | "pageCount" | "from" | "to">;
  total: number;
  selectedId: string | null;
  hrefFor: (id: string) => string;
  pageHref: (page: number) => string;
  onSelect: (id: string) => void;
  onPage: (page: number) => void;
}) {
  const p = useT().employerApplicationsPage;
  const box = "flex h-8 min-w-[32px] items-center justify-center rounded-lg border px-1.5 text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
  const idle = `${box} border-line bg-surface text-ink hover:border-signal hover:text-signal`;
  const go = (page: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onPage(page);
  };

  return (
    <section id="applications-list" role="tabpanel" aria-label={p.listLabel} data-testid="applications-list" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
      <ul className="divide-y divide-line">
        {items.map((a) => (
          <li key={a.id}>
            <ApplicationRow application={a} selected={a.id === selectedId} href={hrefFor(a.id)} onSelect={onSelect} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line px-4 py-3">
        <p className="text-[12.5px] tabular-nums text-dusk" data-testid="applications-range">
          {p.pagination.range(slice.from, slice.to, total)}
        </p>
        {slice.pageCount > 1 && (
          <nav aria-label={p.pagination.label}>
            <ul className="flex items-center gap-1">
              <li>
                {slice.page > 1 ? (
                  <a href={pageHref(slice.page - 1)} onClick={go(slice.page - 1)} aria-label={p.pagination.prev} className={idle}>
                    <IconChevronLeft size={15} />
                  </a>
                ) : (
                  <span aria-hidden className={`${box} border-line text-dusk/50`}>
                    <IconChevronLeft size={15} />
                  </span>
                )}
              </li>
              {pageItems(slice.page, slice.pageCount).map((item, i) =>
                item === "gap" ? (
                  <li key={`gap-${i}`} aria-hidden className="px-0.5 text-dusk">
                    …
                  </li>
                ) : (
                  <li key={item}>
                    <a
                      href={pageHref(item)}
                      onClick={go(item)}
                      aria-label={p.pagination.page(item)}
                      aria-current={item === slice.page ? "page" : undefined}
                      className={item === slice.page ? `${box} border-signal bg-signal text-white` : idle}
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
              <li>
                {slice.page < slice.pageCount ? (
                  <a href={pageHref(slice.page + 1)} onClick={go(slice.page + 1)} aria-label={p.pagination.next} className={idle}>
                    <IconChevronRight size={15} />
                  </a>
                ) : (
                  <span aria-hidden className={`${box} border-line text-dusk/50`}>
                    <IconChevronRight size={15} />
                  </span>
                )}
              </li>
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
