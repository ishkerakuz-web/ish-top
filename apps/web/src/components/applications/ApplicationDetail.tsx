import React, { useId, useRef } from "react";
import { absoluteUploadUrl } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";
import { useHref, useLocale, useT } from "../../lib/i18n/index.js";
import type { MyApplication } from "../../lib/types.js";
import { useDialog } from "../../lib/useDialog.js";
import { CompanyLogo } from "../companies/CompanyLogo.js";
import { useApplicationMeta } from "./ApplicationCard.js";
import { ApplicationStatusBadge } from "./ApplicationStatus.js";
import { ApplicationTimeline } from "./ApplicationTimeline.js";
import { IconArrowRight, IconChat, IconFile, IconVerified, IconX } from "./icons.js";

const SECTION_TITLE = "text-[12px] font-semibold uppercase tracking-[0.08em] text-dusk";

/**
 * Ariza tafsiloti — desktopda o'ngdan panel, telefonda pastdan varaq.
 * Ma'lumot ro'yxatdagi yozuvdan olinadi (qo'shimcha so'rov yo'q). Har bo'lim
 * faqat ma'lumot bo'lsa chiqadi: rezyume, qo'shimcha xat, maosh va h.k.
 */
export function ApplicationDetail({ app, onClose }: { app: MyApplication | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(Boolean(app), panelRef, onClose);
  if (!app) return null;
  return <DetailPanel app={app} onClose={onClose} panelRef={panelRef} titleId={titleId} />;
}

function DetailPanel({
  app,
  onClose,
  panelRef,
  titleId,
}: {
  app: MyApplication;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
  titleId: string;
}) {
  const t = useT();
  const a = t.applicationsPage;
  const d = a.detail;
  const l = useHref();
  const { locale } = useLocale();
  const { region, salary } = useApplicationMeta(app);
  const v = app.vacancy;
  const c = app.company;
  const vacancyHref = v.isClosed ? null : l(`/vacancies/${v.slug}`);
  const companyHref = c.slug ? l(`/companies/${c.slug}`) : null;

  const facts: { key: string; label: string; value: string }[] = [
    { key: "applied", label: d.appliedAt, value: formatDate(app.createdAt, locale) },
  ];
  if (salary) facts.push({ key: "salary", label: d.salary, value: salary });
  if (region) facts.push({ key: "location", label: d.location, value: region });
  if (v.employmentType) facts.push({ key: "employment", label: d.employment, value: t.enums.employment[v.employmentType] });
  if (v.experienceRequired) facts.push({ key: "experience", label: d.experience, value: t.enums.experience[v.experienceRequired] });
  if (app.source === "telegram") facts.push({ key: "source", label: d.source, value: d.sourceTelegram });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-stretch sm:justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop outline-none sm:h-full sm:max-h-none sm:max-w-[460px] sm:animate-drawer-in sm:rounded-none sm:rounded-l-3xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <CompanyLogo name={c.name || v.title} src={c.logoUrl ? absoluteUploadUrl(c.logoUrl) : null} size="sm" />
          <div className="min-w-0 flex-1">
            <p className={SECTION_TITLE}>{d.label}</p>
            <h2 id={titleId} className="mt-0.5 break-words font-display text-[18px] font-bold leading-snug text-ink">
              {v.title}
            </h2>
            {c.name &&
              (companyHref ? (
                <a href={companyHref} className="mt-0.5 inline-flex items-center gap-1 text-[14px] font-medium text-ink/80 hover:text-signal hover:underline">
                  {c.name}
                  {c.isVerified && (
                    <span className="text-signal">
                      <IconVerified size={15} />
                      <span className="sr-only">{a.card.verified}</span>
                    </span>
                  )}
                </a>
              ) : (
                <p className="mt-0.5 text-[14px] font-medium text-ink/80">{c.name}</p>
              ))}
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={d.close}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ApplicationStatusBadge status={app.status} />
              {v.isClosed && (
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-dusk">{a.card.closed}</span>
              )}
            </div>
            {v.isClosed && <p className="mt-2 text-[13px] text-dusk">{d.closedHint}</p>}
          </div>

          <section aria-labelledby={`${titleId}-facts`}>
            <h3 id={`${titleId}-facts`} className={SECTION_TITLE}>
              {d.facts}
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 min-[400px]:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.key} className="min-w-0">
                  <dt className="text-[12.5px] text-dusk">{fact.label}</dt>
                  <dd className="mt-0.5 break-words text-[14px] font-medium text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {app.resume && (
            <section aria-labelledby={`${titleId}-resume`}>
              <h3 id={`${titleId}-resume`} className={SECTION_TITLE}>
                {d.resume}
              </h3>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
                  <IconFile size={18} />
                </span>
                <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{app.resume.title}</p>
                <a href={l("/profile?tab=resume")} className="shrink-0 text-[13px] font-semibold text-signal hover:underline">
                  {d.resumeOpen}
                </a>
              </div>
            </section>
          )}

          {app.coverLetter && (
            <section aria-labelledby={`${titleId}-letter`}>
              <h3 id={`${titleId}-letter`} className={SECTION_TITLE}>
                {d.coverLetter}
              </h3>
              <p className="mt-3 whitespace-pre-line break-words rounded-2xl bg-surface-2/50 p-3.5 text-[14px] leading-relaxed text-ink/90">
                {app.coverLetter}
              </p>
            </section>
          )}

          <section aria-labelledby={`${titleId}-timeline`}>
            <h3 id={`${titleId}-timeline`} className={SECTION_TITLE}>
              {d.timeline}
            </h3>
            <div className="mt-3">
              <ApplicationTimeline app={app} />
            </div>
          </section>

          {app.status !== "sent" && (
            <p className="flex items-start gap-2.5 rounded-2xl border border-line p-3.5 text-[13px] leading-relaxed text-dusk">
              <IconChat size={16} className="mt-0.5 shrink-0" />
              <span>
                {d.responseHint}{" "}
                <a href={l("/messages")} className="font-semibold text-signal hover:underline">
                  {d.messages}
                </a>
              </span>
            </p>
          )}
        </div>

        {(vacancyHref || companyHref) && (
          <div className="flex shrink-0 flex-col gap-2.5 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] min-[420px]:flex-row min-[420px]:gap-3">
            {vacancyHref && (
              <a
                href={vacancyHref}
                className="group inline-flex h-11 shrink-0 items-center min-[420px]:flex-1 justify-center gap-2 rounded-xl bg-signal px-4 text-[14px] font-semibold text-white transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {a.card.openVacancy}
                <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
            {companyHref && (
              <a
                href={companyHref}
                className={`inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-line px-4 text-[14px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal ${
                  vacancyHref ? "" : "min-[420px]:flex-1"
                }`}
              >
                {a.card.companyPage}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
