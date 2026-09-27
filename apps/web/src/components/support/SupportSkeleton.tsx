import React from "react";
import { Skeleton } from "../Skeleton.js";

/** Mavzuga oid maqolalar qidirilayotganda — natija kartalari o'lchamidagi skelet. */
export function SupportSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="support-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-4 w-11/12" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-2/3" />
        </li>
      ))}
    </ul>
  );
}
