import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { Skeleton } from "../Skeleton.js";

/**
 * Ixcham sarlavha: yo'l ko'rsatkichi, "Maqolalar", tavsif va haqiqiy maqolalar
 * soni (API'dan; noma'lum bo'lsa chiqmaydi). O'ngda — berilgan illyustratsiya
 * (`hh.png`, qayta chizilmagan), 768px dan kichikda yashirin.
 */
export function ArticlesHeader({ count, loading }: { count: number | null; loading: boolean }) {
  const t = useT();
  const a = t.articles;
  const l = useHref();
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <nav aria-label={t.companyDetail.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-dusk">
            <li>
              <a href={l("/")} className="transition-colors hover:text-ink">
                {t.search.breadcrumbHome}
              </a>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-ink">
              {a.breadcrumb}
            </li>
          </ol>
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{a.title}</h1>
          {count !== null && count > 0 ? (
            <span data-testid="articles-count" className="rounded-full bg-signal-soft px-3 py-1 text-[12.5px] font-semibold tabular-nums text-signal dark:text-indigo-300">
              {a.count(count)}
            </span>
          ) : loading ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : null}
        </div>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-dusk">{a.subtitle}</p>
      </div>
      <span aria-hidden className="pointer-events-none -my-3 hidden shrink-0 select-none md:block">
        <img src="/articles-news.webp" alt="" width={352} height={220} decoding="async" className="block w-[150px] lg:w-[176px]" />
      </span>
    </header>
  );
}
