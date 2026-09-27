import React from "react";
import { Skeleton } from "../Skeleton.js";

export function VacancyCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-3xl border border-line bg-surface p-4 sm:gap-5 sm:p-5">
      <Skeleton className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="mt-2.5 h-3.5 w-40 max-w-full" />
          </div>
          <Skeleton className="hidden h-5 w-44 sm:block" />
        </div>
        <Skeleton className="mt-4 h-3.5 w-64 max-w-full" />
        <div className="mt-4 flex gap-1.5">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="h-6 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Filtr yoki sahifa o'zgarib, yangi ro'yxat kelguncha. */
export function VacancyListSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <VacancyCardSkeleton key={i} />
      ))}
    </div>
  );
}
