import React, { useMemo, useState } from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { formatRelativeDays } from "../../lib/format.js";
import type { ApplicationStatus, MyApplication } from "../../lib/types.js";
import type { RemoteList } from "../../lib/profile/useProfileData.js";
import { Skeleton } from "../Skeleton.js";
import { useProfileNav } from "./ProfileNavContext.js";
import {
  Card,
  CompanyAvatar,
  EmptyState,
  ErrorState,
  SectionHeader,
  StatusBadge,
  TabLink,
  buttonClass,
} from "./ui.js";
import { IconArrowRight, IconSend } from "./icons.js";

const STATUS_ORDER: ApplicationStatus[] = ["invited", "viewed", "sent", "accepted", "rejected"];

export function ApplicationList({
  list,
  variant,
}: {
  list: RemoteList<MyApplication>;
  variant: "recent" | "full";
}) {
  const t = useT();
  const l = useHref();
  const nav = useProfileNav();
  const a = t.profileHub.applications;
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");

  const counts = useMemo(() => {
    const map = new Map<ApplicationStatus, number>();
    for (const item of list.items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [list.items]);

  const visible =
    variant === "recent"
      ? list.items.slice(0, 5)
      : filter === "all"
        ? list.items
        : list.items.filter((item) => item.status === filter);

  const header =
    variant === "recent" ? (
      <SectionHeader
        title={a.recentTitle}
        action={
          list.items.length > 0 ? (
            <TabLink
              href={nav.href("applications")}
              onNavigate={() => nav.go("applications")}
              className="group inline-flex items-center gap-1 text-[13px] font-semibold text-signal hover:text-signal-dark"
            >
              {a.viewAll}
              <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </TabLink>
          ) : null
        }
      />
    ) : (
      <SectionHeader as="h1" title={a.title} subtitle={a.subtitle} icon={<IconSend size={19} />} />
    );

  return (
    <Card className="p-5 sm:p-6">
      {header}

      {variant === "full" && list.status === "ready" && list.items.length > 0 && (
        <div className="scrollbar-none -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label={a.title}>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={a.filterAll} count={list.items.length} />
          {STATUS_ORDER.filter((s) => counts.get(s)).map((status) => (
            <FilterChip
              key={status}
              active={filter === status}
              onClick={() => setFilter(status)}
              label={a.status[status]}
              count={counts.get(status) ?? 0}
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        {list.status === "loading" ? (
          <ul className="divide-y divide-line" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3.5 py-3.5">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </li>
            ))}
          </ul>
        ) : list.status === "error" ? (
          <ErrorState compact onRetry={() => void list.reload()} />
        ) : list.items.length === 0 ? (
          <EmptyState
            compact={variant === "recent"}
            icon={<IconSend size={20} />}
            title={a.empty}
            hint={a.emptyHint}
            action={
              <a href={l("/vacancies")} className={buttonClass("primary", "sm")}>
                {a.browse}
              </a>
            }
          />
        ) : visible.length === 0 ? (
          <p className="rounded-2xl bg-surface-2/60 px-4 py-6 text-center text-sm text-dusk">{a.filteredEmpty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-3.5 py-3.5 first:pt-1 last:pb-1">
                <CompanyAvatar name={item.company.name || item.vacancy.title} logoUrl={item.company.logoUrl} />
                <div className="min-w-0 flex-1">
                  <a
                    href={l(`/vacancies/${item.vacancy.slug}`)}
                    className="block truncate text-[14.5px] font-semibold text-ink transition-colors hover:text-signal"
                  >
                    {item.vacancy.title}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-dusk">
                    {item.company.name && <span className="truncate">{item.company.name}</span>}
                    {item.company.name && <span aria-hidden>·</span>}
                    <time dateTime={item.createdAt}>{formatRelativeDays(item.createdAt, t.fmt)}</time>
                    {item.vacancy.isClosed && (
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-dusk">
                        {a.closed}
                      </span>
                    )}
                  </p>
                  <div className="mt-2 sm:hidden">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-4 sm:flex">
                  <StatusBadge status={item.status} />
                  <a
                    href={l(`/vacancies/${item.vacancy.slug}`)}
                    className="group inline-flex items-center gap-1 text-[13px] font-semibold text-signal hover:text-signal-dark"
                    aria-label={`${a.details}: ${item.vacancy.title}`}
                  >
                    {a.details}
                    <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
        active ? "border-signal bg-signal-soft text-signal" : "border-line bg-surface text-ink/75 hover:border-signal/40 hover:text-ink"
      }`}
    >
      {label}
      <span className={`font-mono text-[11px] tabular-nums ${active ? "text-signal" : "text-dusk"}`}>{count}</span>
    </button>
  );
}
