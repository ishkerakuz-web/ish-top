import React from "react";

export const PRIMARY_BUTTON =
  "group inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
export const SECONDARY_BUTTON =
  "inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/** Bo'sh / topilmadi / xato holati paneli (maqolalar ro'yxati va sahifasi uchun). */
export function ArticleStatePanel({
  tone = "neutral",
  icon,
  title,
  text,
  role,
  headingLevel = 2,
  children,
  testId,
}: {
  tone?: "neutral" | "danger";
  icon: React.ReactNode;
  title: string;
  text: string;
  role?: "alert";
  headingLevel?: 1 | 2;
  children?: React.ReactNode;
  testId?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div
      role={role}
      data-testid={testId}
      className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center sm:py-16"
    >
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-signal-soft text-signal dark:text-indigo-300"}`}>
        {icon}
      </span>
      <Heading className="mt-5 max-w-md font-display text-xl font-bold text-ink sm:text-2xl">{title}</Heading>
      <p className="mt-2 max-w-sm text-[14.5px] text-dusk">{text}</p>
      {children && <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
