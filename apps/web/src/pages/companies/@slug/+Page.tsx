import React from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { useCompanyDetail, type CompanyDetailData } from "../../../lib/companies/useCompanyDetail.js";
import { Skeleton } from "../../../components/Skeleton.js";
import { CompanyDetailView } from "../../../components/companies/detail/CompanyDetailView.js";
import {
  CompanyDetailError,
  CompanyDetailSkeleton,
  CompanyNotFound,
} from "../../../components/companies/detail/CompanyDetailStates.js";

type Data = Awaited<ReturnType<typeof data>>;

/**
 * `/companies/:slug` — OCHIQ kompaniya profili (mehmon, nomzod uchun).
 * Ish beruvchining boshqaruv sahifalari alohida: `/employer/vacancies` va h.k.
 */
export default function Page() {
  const initial = useData<Data>();
  return <DetailPage key={initial.slug} initial={initial} />;
}

function DetailPage({ initial }: { initial: CompanyDetailData }) {
  const t = useT();
  const { state, retry, retrying } = useCompanyDetail(initial);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:pt-7">
      <Breadcrumb title={state.kind === "ok" ? state.company.name : null} loading={state.kind === "loading"} />
      {state.kind === "ok" ? (
        <CompanyDetailView key={state.company.id} company={state.company} similar={state.similar} />
      ) : state.kind === "loading" ? (
        <CompanyDetailSkeleton label={t.companyDetail.states.loading} />
      ) : state.kind === "not_found" ? (
        <CompanyNotFound />
      ) : (
        <CompanyDetailError onRetry={retry} retrying={retrying} />
      )}
    </div>
  );
}

function Breadcrumb({ title, loading }: { title: string | null; loading: boolean }) {
  const t = useT();
  const l = useHref();
  return (
    <nav aria-label={t.companyDetail.breadcrumb} className="text-[13.5px] text-dusk">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <a href={l("/")} className="rounded-sm transition-colors hover:text-signal">
            {t.search.breadcrumbHome}
          </a>
        </li>
        <li aria-hidden>/</li>
        <li>
          <a href={l("/companies")} className="rounded-sm transition-colors hover:text-signal">
            {t.companies.breadcrumb}
          </a>
        </li>
        {(title || loading) && <li aria-hidden>/</li>}
        {title && (
          <li aria-current="page" className="min-w-0 max-w-[14rem] truncate font-medium text-ink sm:max-w-md">
            {title}
          </li>
        )}
        {!title && loading && (
          <li aria-hidden>
            <Skeleton className="h-4 w-24" />
          </li>
        )}
      </ol>
    </nav>
  );
}
