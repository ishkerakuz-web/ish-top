import React from "react";
import { Skeleton } from "../../Skeleton.js";

/** Maqola sahifasi skeleti: sarlavha, muallif, muqova, matn va yon panel. */
export function ArticleDetailSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-5" aria-busy="true" data-testid="article-skeleton">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px] xl:gap-14">
        <div className="min-w-0 max-w-3xl">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="mt-5 h-10 w-11/12" />
          <Skeleton className="mt-3 h-10 w-2/3" />
          <Skeleton className="mt-5 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-4/5" />
          <div className="mt-6 flex items-center gap-3 border-y border-line py-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div>
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-3.5 w-24" />
            </div>
          </div>
          <Skeleton className="mt-8 aspect-[16/9] w-full rounded-3xl" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-8">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-3 h-4 w-11/12" />
              <Skeleton className="mt-3 h-4 w-3/4" />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
