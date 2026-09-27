import React, { useEffect, useId, useState } from "react";


/** Karta va bo'lim sarlavhasi. */

export function Card({
  children,
  className = "",
  as: Tag = "section",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`rounded-3xl border border-line bg-surface shadow-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
  as: Heading = "h2",
  id,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Heading id={id} className="font-display text-[17px] font-bold leading-tight tracking-tight text-ink">
            {title}
          </Heading>
          {subtitle && <p className="mt-1 text-[13.5px] leading-relaxed text-dusk">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* ---------------------------- forma ---------------------------- */

export const inputBase =
  "w-full rounded-xl border bg-surface-2 text-sm text-ink transition-[border-color,background-color,box-shadow] placeholder:text-dusk/80 focus:bg-surface focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";
