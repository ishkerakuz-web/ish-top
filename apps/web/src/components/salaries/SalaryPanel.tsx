import React from "react";

/**
 * Sahifadagi barcha oq kartochkalarning umumiy qobig'i (grafiklar, jadvallar,
 * xulosalar). `relative` SHART: ichidagi `sr-only` jadvallar sahifani
 * gorizontal kengaytirib yubormasin.
 */
export function SalaryPanel({
  id,
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`relative flex min-w-0 flex-col rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-[17px] font-bold tracking-tight text-ink sm:text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-[13.5px] leading-relaxed text-dusk">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
