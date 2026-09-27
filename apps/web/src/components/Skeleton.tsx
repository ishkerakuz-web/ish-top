import React from "react";

/** Asosiy skeleton bloki — shimmer animatsiyali, mavzuga moslashuvchi. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block rounded-md bg-line shimmer ${className}`} aria-hidden />;
}

export function VacancyCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="mt-2.5 h-5 w-3/4" />
          <Skeleton className="mt-2 h-3.5 w-1/2" />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function CompanyCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
      <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/2" />
        <Skeleton className="mt-3 h-3 w-24" />
      </div>
    </div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  Item,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  Item: React.ComponentType;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}

export function VacancyDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Skeleton className="h-3 w-48" />
      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="mt-3 h-9 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-5 h-7 w-56" />
          <Skeleton className="mt-8 h-5 w-40" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
        <div className="w-full shrink-0 lg:w-80">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
