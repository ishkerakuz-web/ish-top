import React, { useId } from "react";
import type { VacancyDetailVM } from "../../../lib/vacancies/detail.js";
import type { useApplication } from "../../../lib/vacancies/useApplication.js";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { formatDate } from "../../../lib/format.js";
import { PhoneGateNotice } from "../../PhoneGateNotice.js";
import { Skeleton } from "../../Skeleton.js";
import { IconArrowRight, IconCheckCircle, IconFile, IconMail, IconPhone, IconTelegram, Spinner } from "./icons.js";

export type ApplyState = ReturnType<typeof useApplication>;

export interface ApplyLinks {
  login: string;
  signup: string;
  resume: string;
  applications: string;
}

export const PRIMARY_CTA =
  "glow-signal group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 text-[15px] font-bold text-white transition-colors hover:bg-signal-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Nomzod rezyumesini to'ldirmagan va vakansiya rezyumesiz arizani qabul qilmaydi. */
export function needsResume(vacancy: VacancyDetailVM, apply: ApplyState): boolean {
  return apply.phase.kind === "ready" && !vacancy.applyWithoutResume && apply.phase.resumeKnown && !apply.phase.resume;
}

/**
 * "Ariza yuborish" kartasi. Holatlar faqat haqiqiy ma'lumotdan: mehmon →
 * kirish; nomzod → rezyume + tugma; yuborilgan → backend'dagi ariza holati;
 * ish beruvchi → izoh. Bog'lanish yo'llari (bo'lsa) kartaning pastida.
 */
export function ApplyCard({
  vacancy,
  apply,
  links,
  cardRef,
  className = "",
}: {
  vacancy: VacancyDetailVM;
  apply: ApplyState;
  links: ApplyLinks;
  cardRef?: React.Ref<HTMLElement>;
  className?: string;
}) {
  const t = useT();
  const d = t.vacancyDetail.apply;
  const { locale } = useLocale();
  const headingId = useId();
  const { phase } = apply;

  const deadline = vacancy.expiresAt && new Date(vacancy.expiresAt).getTime() > Date.now() ? formatDate(vacancy.expiresAt, locale) : null;
  const { email, telegram, phone } = vacancy.contacts;
  const hasContacts = Boolean(email || telegram || phone);

  return (
    <section
      ref={cardRef}
      aria-labelledby={headingId}
      className={`rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="font-display text-lg font-bold tracking-tight text-ink">
          {d.title}
        </h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-growth/10 px-2.5 py-1 text-[12px] font-semibold text-growth">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-growth" />
          {d.open}
        </span>
      </div>
      <p className="mt-1 text-[13.5px] text-dusk">{d.subtitle}</p>
      {deadline && <p className="mt-0.5 text-[12.5px] font-medium text-dusk">{d.until(deadline)}</p>}

      {phase.kind === "loading" && (
        <div className="mt-4 space-y-3" aria-busy="true">
          <span className="sr-only">{d.loading}</span>
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      )}

      {phase.kind === "guest" && (
        <div className="mt-4">
          <p className="text-[13.5px] text-ink/75">{d.guestHint}</p>
          <a href={links.login} className={`${PRIMARY_CTA} mt-3`}>
            {d.guestCta}
            <IconArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <p className="mt-3 text-center text-[13px] text-dusk">
            {d.signupPrompt}{" "}
            <a href={links.signup} className="font-semibold text-signal hover:underline">
              {d.signup}
            </a>
          </p>
        </div>
      )}

      {phase.kind === "blocked" && <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-dusk">{d.employer}</p>}

      {phase.kind === "ready" && (
        <div className="mt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal font-display text-[15px] font-bold text-white"
            >
              {(apply.displayName.charAt(0) || "?").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{apply.displayName}</p>
              <p className="truncate text-[12.5px] text-dusk">
                {phase.resume ? `${d.resume} · ${phase.resume.title}` : phase.resumeKnown ? d.noResume : d.resume}
              </p>
            </div>
            {phase.resume && <IconCheckCircle size={20} className="shrink-0 text-growth" />}
          </div>

          {needsResume(vacancy, apply) || apply.error?.kind === "resume" ? (
            <>
              <p className="mt-3 text-[13.5px] text-ink/75">{d.noResumeHint}</p>
              <a href={links.resume} className={`${PRIMARY_CTA} mt-3`}>
                <IconFile size={17} />
                {d.fillResume}
              </a>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void apply.apply()}
                disabled={apply.submitting}
                aria-busy={apply.submitting || undefined}
                className={`${PRIMARY_CTA} mt-4`}
              >
                {apply.submitting ? <Spinner size={17} /> : null}
                {apply.submitting ? d.submitting : d.cta}
                {!apply.submitting && <IconArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />}
              </button>
              {vacancy.applyWithoutResume && !phase.resume && <p className="mt-2.5 text-center text-[12.5px] text-dusk">{d.withoutResume}</p>}
            </>
          )}

          {apply.error?.kind === "phone" && <PhoneGateNotice className="mt-3" />}
          {apply.error?.kind === "failed" && (
            <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {d.error}
            </p>
          )}
        </div>
      )}

      {phase.kind === "applied" && (
        <div className="mt-4">
          <div className="rounded-2xl border border-growth/30 bg-growth/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-growth">
              <IconCheckCircle size={20} />
              {d.appliedTitle}
            </p>
            <dl className="mt-2.5 space-y-1 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-dusk">{d.status}</dt>
                <dd className="font-semibold text-ink">{t.profileHub.applications.status[phase.status]}</dd>
              </div>
            </dl>
            {phase.appliedAt && <p className="mt-1 text-[12.5px] text-dusk">{d.appliedOn(formatDate(phase.appliedAt, locale))}</p>}
          </div>
          <a href={links.applications} className="group mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-signal hover:underline">
            {d.myApplications}
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      )}

      {hasContacts && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-[13.5px] font-semibold text-ink">{d.contacts}</h3>
          <ul className="mt-2.5 flex flex-col gap-2">
            {phone && (
              <ContactRow href={`tel:${phone.replace(/[^+\d]/g, "")}`} label={phone} icon={<IconPhone size={17} />} />
            )}
            {telegram && (
              <ContactRow href={`https://t.me/${encodeURIComponent(telegram)}`} label={`@${telegram}`} icon={<IconTelegram size={17} />} external />
            )}
            {email && <ContactRow href={`mailto:${email}`} label={email} icon={<IconMail size={17} />} />}
          </ul>
        </div>
      )}
    </section>
  );
}

function ContactRow({ href, label, icon, external = false }: { href: string; label: string; icon: React.ReactNode; external?: boolean }) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:border-signal/40 hover:text-signal"
      >
        <span className="shrink-0 text-dusk transition-colors group-hover:text-signal">{icon}</span>
        <span className="truncate">{label}</span>
      </a>
    </li>
  );
}
