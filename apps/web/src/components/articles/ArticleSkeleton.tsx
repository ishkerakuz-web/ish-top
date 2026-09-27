import React from "react";
import { Skeleton } from "../Skeleton.js";

function CardSkeleton({ cover }: { cover: boolean }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      {cover && <Skeleton className="aspect-[16/10] w-full rounded-none" />}
      <div className="p-5">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="mt-4 h-5 w-11/12" />
        <Skeleton className="mt-2 h-5 w-2/3" />
        <Skeleton className="mt-4 h-3.5 w-full" />
        <Skeleton className="mt-2 h-3.5 w-5/6" />
        <Skeleton className="mt-5 h-4 w-28" />
      </div>
    </div>
  );
}

/** Ro'yxat skeleti: katta karta (kerak bo'lsa) va kartalar to'ri — layout sakramasin. */
export function ArticleListSkeleton({ featured, label }: { featured: boolean; label: string }) {
  return (
    <div aria-busy="true" data-testid="articles-skeleton">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden>
        {featured && (
          <div className="grid overflow-hidden rounded-3xl border border-line bg-surface md:grid-cols-[1.12fr_1fr]">
            <Skeleton className="aspect-[16/10] w-full rounded-none md:aspect-auto md:min-h-[300px] lg:min-h-[340px]" />
            <div className="p-6 sm:p-8 lg:p-10">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-4 h-5 w-48" />
              <Skeleton className="mt-4 h-8 w-11/12" />
              <Skeleton className="mt-2 h-8 w-3/4" />
              <Skeleton className="mt-5 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-7 h-5 w-36" />
            </div>
          </div>
        )}
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 ${featured ? "mt-6" : ""}`}>
          {[true, true, false, true, false, true].map((cover, i) => (
            <CardSkeleton key={i} cover={cover} />
          ))}
        </div>
      </div>
    </div>
  );
}
