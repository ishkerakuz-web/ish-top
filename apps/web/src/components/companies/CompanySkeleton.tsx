import React from "react";
import { Skeleton } from "../Skeleton.js";
import type { CardView } from "./CompanyCard.js";

export function CompanyCardSkeleton({ view = "grid" }: { view?: CardView }) {
  if (view === "list") {
    return (
      <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-3 h-3 w-40" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3.5">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="flex-1 pt-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-5 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <Skeleton className="mt-5 h-3 w-2/3" />
      <Skeleton className="mt-5 h-10 w-full rounded-xl" />
    </div>
  );
}

export function CompanyGridSkeleton({ count, view = "grid" }: { count: number; view?: CardView }) {
  return (
    <div className={gridClass(view)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <CompanyCardSkeleton key={i} view={view} />
      ))}
    </div>
  );
}

/** Yon panel yonidagi kenglikka mos: 1 → 2 → (xl) 3 ustun; ro'yxat — bitta ustun. */
export function gridClass(view: CardView): string {
  return view === "list" ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";
}

export function FeaturedSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex w-[228px] shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="space-y-6 rounded-3xl border border-line bg-surface p-5" aria-hidden>
      {[5, 1, 4, 3].map((rows, i) => (
        <div key={i}>
          <Skeleton className="h-3.5 w-24" />
          {Array.from({ length: rows }, (_, j) => (
            <Skeleton key={j} className="mt-3 h-3 w-3/4" />
          ))}
        </div>
      ))}
    </div>
  );
}
