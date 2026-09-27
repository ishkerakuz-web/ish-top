import React, { useEffect, useMemo } from "react";
import { extractLinks, type ConversationCompany, type ConversationVacancy, type ConversationView, type MessageLink } from "../../lib/messages/adapter.js";
import type { PartnerState, ThreadState } from "../../lib/messages/useMessenger.js";
import { formatDate, formatSalary } from "../../lib/format.js";
import { useHref, useLocale, useT } from "../../lib/i18n/index.js";
import type { ConversationRating } from "../../lib/types.js";
import { CompanyLogo } from "../companies/CompanyLogo.js";
import { Skeleton } from "../Skeleton.js";
import { StarRating } from "../StarRating.js";
import {
  EmploymentIcon,
  IconArrowRight,
  IconBriefcase,
  IconClock,
  IconExternal,
  IconLink,
  IconPin,
  IconVerified,
  IconWallet,
} from "./icons.js";
import { ParticipantAvatar, displayName } from "./participant.js";

const CARD = "rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5";
const TITLE = "font-display text-[15px] font-bold tracking-tight text-ink";
const OUTLINE_LINK =
  "mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13.5px] font-semibold text-signal transition-colors hover:border-signal/40 hover:bg-signal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/** Suhbatdoshning baholari (o'zaro baho tizimi) — faqat baho bo'lsa. */
function RatingLine({ rating }: { rating: ConversationRating | null }) {
  const m = useT().messagesPage;
  if (!rating || rating.otherCount === 0 || rating.otherAvg === null) return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-dusk">
      <StarRating value={rating.otherAvg} className="text-[13px]" />
      {m.chat.rating(rating.otherAvg.toFixed(1), rating.otherCount)}
    </p>
  );
}

function MyRating({ rating }: { rating: ConversationRating | null }) {
  const m = useT().messagesPage;
  if (!rating?.myScore) return null;
  return <p className="mt-2 text-[12.5px] text-dusk">{m.details.myRating(rating.myScore)}</p>;
}

function CompanyDetails({ company, rating, id }: { company: ConversationCompany; rating: ConversationRating | null; id: string }) {
  const t = useT();
  const m = t.messagesPage;
  const l = useHref();
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex items-start gap-3">
        <CompanyLogo name={company.name} src={company.logoUrl} size="md" />
        <div className="min-w-0">
          <h3 id={id} className="flex items-center gap-1.5 font-display text-[16px] font-bold leading-snug text-ink">
            <span className="break-words">{company.name}</span>
            {company.isVerified && (
              <>
                <IconVerified size={16} className="shrink-0 text-signal" />
                <span className="sr-only">{m.chat.verified}</span>
              </>
            )}
          </h3>
          {company.industry && <p className="mt-0.5 text-[13px] text-dusk">{company.industry}</p>}
          {company.regionName && (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-dusk">
              <IconPin size={14} />
              {company.regionName}
            </p>
          )}
          <RatingLine rating={rating} />
        </div>
      </div>
      {company.description && <p className="mt-3 line-clamp-5 text-[13.5px] leading-relaxed text-ink/80">{company.description}</p>}
      <MyRating rating={rating} />
      {company.slug && (
        <a href={l(`/companies/${company.slug}`)} className={OUTLINE_LINK}>
          {m.details.companyPage}
          <IconArrowRight size={15} />
        </a>
      )}
    </section>
  );
}

/** Kompaniyasiz admin suhbati — platforma qo'llab-quvvatlashi. */
function SupportDetails({ id }: { id: string }) {
  const m = useT().messagesPage;
  const l = useHref();
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex items-center gap-3">
        <CompanyLogo name="ISH BOR!" size="md" />
        <div className="min-w-0">
          <h3 id={id} className="font-display text-[16px] font-bold leading-snug text-ink">
            {m.supportName}
          </h3>
          <p className="mt-0.5 text-[13px] text-dusk">{m.roles.admin}</p>
        </div>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-dusk">{m.details.supportText}</p>
      <a href={l("/support")} className={OUTLINE_LINK}>
        {m.details.supportCta}
        <IconArrowRight size={15} />
      </a>
    </section>
  );
}

/** Ish beruvchi ko'rinishi: nomzodning qisqa profili (mavjud `/api/users/:id/summary`). */
function PartnerDetails({
  conversation,
  partner,
  rating,
  id,
  onRetry,
}: {
  conversation: ConversationView;
  partner: PartnerState | undefined;
  rating: ConversationRating | null;
  id: string;
  onRetry: () => void;
}) {
  const m = useT().messagesPage;
  const name = displayName(conversation, m);
  const summary = partner && partner !== "loading" && partner !== "error" ? partner : null;
  const headline = conversation.headline ?? summary?.headline ?? null;
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex items-start gap-3">
        <ParticipantAvatar conversation={conversation} name={name} size="md" />
        <div className="min-w-0">
          <h3 id={id} className="break-words font-display text-[16px] font-bold leading-snug text-ink">
            {name}
          </h3>
          {headline && <p className="mt-0.5 text-[13px] text-dusk">{headline}</p>}
          {summary?.regionName && (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-dusk">
              <IconPin size={14} />
              {summary.regionName}
            </p>
          )}
          <RatingLine rating={rating} />
        </div>
      </div>
      {(!partner || partner === "loading") && (
        <div aria-hidden className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      )}
      {partner === "error" && (
        <div className="mt-3 text-[13px] text-dusk">
          {m.details.profileError}{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            {m.details.retry}
          </button>
        </div>
      )}
      {summary && (
        <div className="mt-3 space-y-2.5 text-[13.5px]">
          {summary.role === "job_seeker" && summary.isOpenToWork && (
            <p className="inline-flex rounded-md bg-growth/10 px-2 py-0.5 text-[12px] font-semibold text-growth">{m.details.openToWork}</p>
          )}
          {summary.resumeTitle && (
            <p className="flex gap-2 text-ink">
              <IconBriefcase size={16} className="mt-0.5 shrink-0 text-dusk" />
              <span>
                <span className="sr-only">{m.details.resume}: </span>
                {summary.resumeTitle}
              </span>
            </p>
          )}
          {summary.skills.length > 0 && (
            <div>
              <p className="sr-only">{m.details.skills}</p>
              <ul className="flex flex-wrap gap-1.5">
                {summary.skills.slice(0, 10).map((skill) => (
                  <li key={skill} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-dusk">
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <MyRating rating={rating} />
    </section>
  );
}

/** "Suhbat haqida" — bog'liq vakansiya. Vakansiya bo'lmasa karta chizilmaydi. */
function VacancyDetails({ vacancy, id }: { vacancy: ConversationVacancy; id: string }) {
  const t = useT();
  const m = t.messagesPage;
  const l = useHref();
  const salary = vacancy.salary ? formatSalary(vacancy.salary.min, vacancy.salary.max, t.fmt) : null;
  const row = "flex gap-2.5";
  const icon = "mt-0.5 shrink-0 text-dusk";
  return (
    <section aria-labelledby={id} className={CARD}>
      <h3 id={id} className={TITLE}>
        {m.details.about}
      </h3>
      <ul className="mt-3 space-y-2.5 text-[13.5px] text-ink/90">
        <li className={`${row} font-semibold text-ink`}>
          <IconBriefcase size={16} className={icon} />
          <span className="min-w-0 break-words">
            <span className="sr-only">{m.vacancy.label}: </span>
            {vacancy.title}
          </span>
        </li>
        {vacancy.regionName && (
          <li className={row}>
            <IconPin size={16} className={icon} />
            {vacancy.regionName}
          </li>
        )}
        {vacancy.employmentType && (
          <li className={row}>
            <EmploymentIcon type={vacancy.employmentType} size={16} className={icon} />
            {t.enums.employment[vacancy.employmentType]}
          </li>
        )}
        {vacancy.experience && (
          <li className={row}>
            <IconClock size={16} className={icon} />
            {t.enums.experience[vacancy.experience]}
          </li>
        )}
        {salary && (
          <li className={`${row} font-semibold text-growth`}>
            <IconWallet size={16} className="mt-0.5 shrink-0" />
            {salary}
          </li>
        )}
      </ul>
      {vacancy.isClosed ? (
        <p className="mt-3 text-[12.5px] text-dusk">{m.vacancy.closed}</p>
      ) : (
        <a
          href={l(`/vacancies/${vacancy.slug}`)}
          className="mt-3 inline-flex items-center gap-1 rounded-md text-[13.5px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {m.details.vacancyLink}
          <IconArrowRight size={14} />
        </a>
      )}
    </section>
  );
}

/**
 * "Havolalar" — suhbatda yuborilgan http(s) havolalar. Backend xabarga fayl biriktirishni
 * qo'llamaydi, shuning uchun fayl ro'yxati yo'q; havola bo'lmasa karta chizilmaydi.
 */
function AttachmentList({ links, id }: { links: MessageLink[]; id: string }) {
  const m = useT().messagesPage;
  const { locale } = useLocale();
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex items-center gap-2">
        <h3 id={id} className={TITLE}>
          {m.details.links}
        </h3>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-dusk">{links.length}</span>
      </div>
      <ul className="mt-2 space-y-0.5">
        {links.slice(0, 8).map((link) => {
          const sub = [link.path, link.at ? formatDate(link.at, locale) : null].filter(Boolean).join(" · ");
          return (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="group -mx-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal">
                  <IconLink size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-signal">{link.host}</span>
                  {sub && <span className="block truncate text-[12px] text-dusk">{sub}</span>}
                </span>
                <IconExternal size={15} className="shrink-0 text-dusk" />
                <span className="sr-only">{m.details.newTab}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * O'ng panel (xl) va "i" dialogi mazmuni. Ma'lumotga qarab yig'iladi: kompaniya /
 * qo'llab-quvvatlash / nomzod, vakansiya (bo'lsa), havolalar (bo'lsa). Bo'sh karta yo'q.
 */
export function ConversationDetails({
  conversation,
  thread,
  rating,
  partner,
  idPrefix,
  onLoadPartner,
}: {
  conversation: ConversationView;
  thread: ThreadState | undefined;
  rating: ConversationRating | null;
  partner: PartnerState | undefined;
  idPrefix: string;
  onLoadPartner: (userId: string, force?: boolean) => void;
}) {
  const links = useMemo(() => extractLinks(thread?.items ?? []), [thread?.items]);
  const company = conversation.otherRole === "employer" ? conversation.company : null;
  const support = conversation.otherRole === "admin" && !conversation.company;
  const showPartner = !company && !support;
  const otherUserId = conversation.otherUserId;

  useEffect(() => {
    if (showPartner && otherUserId) onLoadPartner(otherUserId);
  }, [showPartner, otherUserId, onLoadPartner]);

  return (
    <>
      {company ? (
        <CompanyDetails company={company} rating={rating} id={`${idPrefix}-company`} />
      ) : support ? (
        <SupportDetails id={`${idPrefix}-support`} />
      ) : (
        <PartnerDetails
          conversation={conversation}
          partner={partner}
          rating={rating}
          id={`${idPrefix}-partner`}
          onRetry={() => otherUserId && onLoadPartner(otherUserId, true)}
        />
      )}
      {conversation.vacancy && <VacancyDetails vacancy={conversation.vacancy} id={`${idPrefix}-vacancy`} />}
      {links.length > 0 && <AttachmentList links={links} id={`${idPrefix}-links`} />}
    </>
  );
}
