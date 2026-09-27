import React from "react";
import { useHref, useT } from "../../../lib/i18n/index.js";
import { IconAlert, IconArrowRight, IconBriefcase, IconRefresh, Spinner } from "./icons.js";

export const PRIMARY =
  "group inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** Sahifa darajasidagi holat paneli (xato / topilmadi) — vakansiya va kompaniya sahifalari uchun umumiy. */
export function Panel({
  tone,
  icon,
  title,
  text,
  role,
  children,
}: {
  tone: "neutral" | "danger";
  icon: React.ReactNode;
  title: string;
  text: string;
  role?: "alert";
  children: React.ReactNode;
}) {
  return (
    <div role={role} className="mx-auto mt-6 flex max-w-2xl flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-14 text-center sm:py-16">
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-signal-soft text-signal"}`}>
        {icon}
      </span>
      <h1 className="mt-5 max-w-md font-display text-xl font-bold text-ink sm:text-2xl">{title}</h1>
      <p className="mt-2 max-w-sm text-[14.5px] text-dusk">{text}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

/** API xatosi — "Vakansiyani yuklab bo'lmadi." + "Qayta urinish". */
export function VacancyDetailError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useT();
  const s = t.vacancyDetail.states;
  const l = useHref();
  return (
    <Panel role="alert" tone="danger" icon={<IconAlert size={26} />} title={s.errorTitle} text={s.errorText}>
      <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined} className={PRIMARY}>
        {retrying ? <Spinner size={16} /> : <IconRefresh size={16} />}
        {s.retry}
      </button>
      <a
        href={l("/vacancies")}
        className="inline-flex h-11 items-center rounded-xl border border-line px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal"
      >
        {s.back}
      </a>
    </Panel>
  );
}

/** Vakansiya yo'q (404) yoki yopilgan. Server 404 holatida `_error` sahifasi ham shuni chizadi. */
export function VacancyNotFound() {
  const s = useT().vacancyDetail.states;
  const l = useHref();
  return (
    <Panel tone="neutral" icon={<IconBriefcase size={26} />} title={s.notFoundTitle} text={s.notFoundText}>
      <a href={l("/vacancies")} className={PRIMARY}>
        {s.back}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </Panel>
  );
}
