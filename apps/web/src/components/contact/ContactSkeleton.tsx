import React from "react";
import { Skeleton } from "../Skeleton.js";

/** Aloqa kanallari brauzerda qayta yuklanayotganda — karta o'lchamidagi skelet (forma bu vaqtda ham ishlaydi). */
export function ContactSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" data-testid="contact-channels-loading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-3.5 w-56 max-w-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mt-5 flex gap-3.5">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="mt-2 h-3.5 w-40 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
