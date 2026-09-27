import React from "react";
import { useT, useHref, useLocale } from "../../lib/i18n/index.js";
import { formatSalary, regionDisplayName } from "../../lib/format.js";
import { removeFavorite } from "../../lib/apiExtra.js";
import type { FavoriteVacancy } from "../../lib/types.js";
import type { RemoteList } from "../../lib/profile/useProfileData.js";
import { VacancyCard } from "../VacancyCard.js";
import { Skeleton, SkeletonGrid, VacancyCardSkeleton } from "../Skeleton.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { Card, CompanyAvatar, EmptyState, ErrorState, SectionHeader, TabLink, buttonClass } from "./ui.js";
import { IconArrowRight, IconHeart } from "./icons.js";

export function SavedJobs({
  list,
  token,
  variant,
}: {
  list: RemoteList<FavoriteVacancy>;
  token: string;
  variant: "recent" | "full";
}) {
  const t = useT();
  const { locale } = useLocale();
  const l = useHref();
  const nav = useProfileNav();
  const s = t.profileHub.saved;

  /** Optimistik: kartochka darhol yo'qoladi, server rad etsa qaytib keladi. */
  async function drop(vacancyId: string) {
    const previous = list.items;
    list.setItems((prev) => prev.filter((v) => v.id !== vacancyId));
    try {
      await removeFavorite(token, vacancyId);
    } catch {
      list.setItems(previous);
    }
  }

  const empty = (
    <EmptyState
      compact={variant === "recent"}
      icon={<IconHeart size={20} />}
      title={s.empty}
      hint={s.emptyHint}
      action={
        <a href={l("/vacancies")} className={buttonClass("primary", "sm")}>
          {s.browse}
        </a>
      }
    />
  );

  if (variant === "full") {
    return (
      <Card className="p-5 sm:p-6">
        <SectionHeader as="h1" title={s.title} subtitle={s.subtitle} icon={<IconHeart size={19} />} />
        <div className="mt-5">
          {list.status === "loading" ? (
            <SkeletonGrid count={4} Item={VacancyCardSkeleton} className="grid grid-cols-1 gap-4 md:grid-cols-2" />
          ) : list.status === "error" ? (
            <ErrorState onRetry={() => void list.reload()} />
          ) : list.items.length === 0 ? (
            empty
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {list.items.map((vacancy, i) => (
                <div key={vacancy.id} className="relative">
                  {vacancy.isClosed && (
                    <span className="absolute right-4 top-4 z-20 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dusk">
                      {s.closed}
                    </span>
                  )}
                  <div className={vacancy.isClosed ? "opacity-60" : ""}>
                    <VacancyCard vacancy={vacancy} index={i} favorite onToggleFavorite={drop} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader
        title={s.title}
        action={
          list.items.length > 0 ? (
            <TabLink
              href={nav.href("saved")}
              onNavigate={() => nav.go("saved")}
              className="group inline-flex items-center gap-1 text-[13px] font-semibold text-signal hover:text-signal-dark"
            >
              {s.viewAll}
              <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </TabLink>
          ) : null
        }
      />
      <div className="mt-4">
        {list.status === "loading" ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-2xl border border-line p-4">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                  <Skeleton className="mt-3 h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : list.status === "error" ? (
          <ErrorState compact onRetry={() => void list.reload()} />
        ) : list.items.length === 0 ? (
          empty
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.items.slice(0, 4).map((vacancy) => (
              <li key={vacancy.id}>
                <a
                  href={l(`/vacancies/${vacancy.slug}`)}
                  className={`group flex h-full gap-3 rounded-2xl border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/35 hover:shadow-card-hover ${
                    vacancy.isClosed ? "opacity-60" : ""
                  }`}
                >
                  <CompanyAvatar name={vacancy.companyName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink transition-colors group-hover:text-signal">
                      {vacancy.title}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-dusk">
                      {[vacancy.companyName, regionDisplayName(locale, vacancy.regionName, vacancy.regionSlug)].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-growth">
                        {formatSalary(vacancy.salaryMin, vacancy.salaryMax, t.fmt, vacancy.isSalaryHidden, locale)}
                      </span>
                      {vacancy.isClosed ? (
                        <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-dusk">
                          {s.closed}
                        </span>
                      ) : (
                        <IconHeart size={16} filled className="shrink-0 text-danger/80" />
                      )}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
