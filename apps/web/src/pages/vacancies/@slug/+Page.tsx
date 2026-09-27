import React from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { useVacancyDetail, type VacancyDetailData } from "../../../lib/vacancies/useVacancyDetail.js";
import { Skeleton } from "../../../components/Skeleton.js";
import { VacancyDetailView } from "../../../components/vacancies/detail/VacancyDetailView.js";
import { VacancyDetailSkeleton } from "../../../components/vacancies/detail/VacancyDetailSkeleton.js";
import { VacancyDetailError, VacancyNotFound } from "../../../components/vacancies/detail/VacancyDetailStates.js";

type Data = Awaited<ReturnType<typeof data>>;

/** `/vacancies/:slug` — vakansiya detail. Har slug uchun holat noldan (client navigatsiyada ham). */
export default function Page() {
  const initial = useData<Data>();
  return <DetailPage key={initial.slug} initial={initial} />;
}

function DetailPage({ initial }: { initial: VacancyDetailData }) {
  const t = useT();
  const { state, retry, retrying } = useVacancyDetail(initial);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:pt-7">
      <Breadcrumb title={state.kind === "ok" ? state.vacancy.title : null} loading={state.kind === "loading"} />
      {state.kind === "ok" ? (
        <VacancyDetailView key={state.vacancy.id} vacancy={state.vacancy} similar={state.similar} />
      ) : state.kind === "loading" ? (
        <VacancyDetailSkeleton label={t.vacancyDetail.states.loading} />
      ) : state.kind === "not_found" ? (
        <VacancyNotFound />
      ) : (
        <VacancyDetailError onRetry={retry} retrying={retrying} />
      )}
    </div>
  );
}

function Breadcrumb({ title, loading }: { title: string | null; loading: boolean }) {
  const t = useT();
  const l = useHref();
  return (
    <nav aria-label={t.vacancyDetail.breadcrumb} className="text-[13.5px] text-dusk">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <a href={l("/")} className="rounded-sm transition-colors hover:text-signal">
            {t.search.breadcrumbHome}
          </a>
        </li>
        <li aria-hidden>/</li>
        <li>
          <a href={l("/vacancies")} className="rounded-sm transition-colors hover:text-signal">
            {t.search.breadcrumbVacancies}
          </a>
        </li>
        {(title || loading) && <li aria-hidden>/</li>}
        {title && (
          <li aria-current="page" className="min-w-0 max-w-[14rem] truncate text-ink sm:max-w-md">
            {title}
          </li>
        )}
        {!title && loading && (
          <li aria-hidden>
            <Skeleton className="h-4 w-32" />
          </li>
        )}
      </ol>
    </nav>
  );
}
