import React from "react";
import { Skeleton } from "../../Skeleton.js";

/**
 * Qayta yuklash paytidagi skelet — haqiqiy sahifa bilan bir xil ustunlar va
 * taxminiy balandliklar (yuklangach sakrash kam bo'lsin). Rasmlar bor-yo'qligi
 * oldindan noma'lum, shuning uchun galereya skeleti chizilmaydi.
 */
export function VacancyDetailSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_372px] xl:gap-8" aria-busy="true">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div className="min-w-0" aria-hidden>
        <div className="flex items-start gap-4 sm:gap-5">
          <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-[88px] sm:w-[88px] sm:rounded-3xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-8 w-4/5 max-w-md" />
            <Skeleton className="mt-3 h-4 w-44" />
            <Skeleton className="mt-3 h-6 w-64 max-w-full" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          {["w-28", "w-32", "w-24"].map((w) => (
            <Skeleton key={w} className={`h-5 ${w}`} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["w-16", "w-20", "w-24", "w-14", "w-[4.5rem]"].map((w) => (
            <Skeleton key={w} className={`h-8 rounded-xl ${w}`} />
          ))}
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-surface">
          <div className="flex gap-6 border-b border-line px-6 py-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-6 h-6 w-36" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-3/4" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-60 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    </div>
  );
}
