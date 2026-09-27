import React from "react";
import { Skeleton } from "../Skeleton.js";

const BARS = ["h-[20%]", "h-[35%]", "h-[80%]", "h-[55%]", "h-[62%]", "h-[25%]"];

/** Filtr o'zgarib, yangi raqamlar kelguncha — sahifa tuzilishi saqlanadi (sakrash yo'q). */
export function SalarySkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="mt-2.5 h-3.5 w-72 max-w-full" />
          <Skeleton className="mt-2 h-3.5 w-28" />
        </div>
        <Skeleton className="hidden h-11 w-80 rounded-xl md:block" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex gap-4 rounded-3xl border border-line bg-surface p-5 ${i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-3 h-6 w-44 max-w-full" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
            <div className="mt-8 flex h-[210px] items-end justify-around gap-3 border-b border-line px-2">
              {BARS.map((h, j) => (
                <Skeleton key={j} className={`w-full max-w-[48px] rounded-b-none rounded-t-lg ${h}`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <Skeleton className="h-5 w-56 max-w-full" />
            {Array.from({ length: 6 }, (_, j) => (
              <div key={j} className="mt-4 flex items-center gap-4">
                <Skeleton className="h-3 w-4" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
