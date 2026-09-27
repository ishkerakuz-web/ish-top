import React from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { formatNumber } from "../../lib/format.js";
import type { CompletionItem } from "../../lib/profile/completion.js";
import type { RemoteList } from "../../lib/profile/useProfileData.js";
import type { ProfileTab } from "../../lib/profile/tabs.js";
import type { FavoriteVacancy, MyApplication, Profile, ResumeData, TelegramStatus } from "../../lib/types.js";
import { Skeleton } from "../Skeleton.js";
import { TelegramConnect } from "../TelegramConnect.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { ApplicationList } from "./ApplicationList.js";
import { ProfileCompletion } from "./ProfileCompletion.js";
import { SavedJobs } from "./SavedJobs.js";
import { Card, ProgressRing, SectionHeader, TabLink } from "./ui.js";
import { IconArrowRight, IconFile, IconHeart, IconSend, IconSpark } from "./icons.js";

/**
 * "Umumiy" — /profile ochilganda birinchi ko'rinadigan dashboard.
 * Birinchi ekran to'rt savolga javob beradi: profil qanchalik tayyor,
 * rezyume holati, nechta ariza, nechta saqlangan ish.
 */
export function ProfileOverview({
  token,
  profile,
  resume,
  resumeReady,
  completion,
  applications,
  favorites,
  onTelegramStatus,
}: {
  token: string;
  profile: Profile | null;
  resume: ResumeData | null;
  resumeReady: boolean;
  completion: { items: CompletionItem[]; done: number; total: number; percent: number };
  applications: RemoteList<MyApplication>;
  favorites: RemoteList<FavoriteVacancy>;
  onTelegramStatus: (status: TelegramStatus) => void;
}) {
  const t = useT();
  const nav = useProfileNav();
  const sum = t.profileHub.summary;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t.profileHub.nav.overview}</h1>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryCard
          tab="overview"
          scrollTo="completion-title"
          label={sum.completion}
          icon={
            <ProgressRing value={completion.percent} size={38} stroke={4.5} label={sum.completion}>
              <IconSpark size={14} className="text-signal" />
            </ProgressRing>
          }
          value={`${completion.percent}%`}
          accent={completion.percent >= 100 ? "text-growth" : "text-ink"}
        />
        <SummaryCard
          tab="resume"
          step={6}
          label={sum.resume}
          icon={<IconTile tone="violet"><IconFile size={18} /></IconTile>}
          value={resumeReady ? sum.resumeReady : sum.resumeIncomplete}
          accent={resumeReady ? "text-growth" : "text-gold-deep"}
          small
        />
        <SummaryCard
          tab="applications"
          label={sum.applications}
          icon={<IconTile tone="blue"><IconSend size={18} /></IconTile>}
          value={applications.status === "ready" ? sum.count(applications.items.length) : null}
        />
        <SummaryCard
          tab="saved"
          label={sum.saved}
          icon={<IconTile tone="pink"><IconHeart size={18} /></IconTile>}
          value={favorites.status === "ready" ? sum.count(favorites.items.length) : null}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ProfileCompletion completion={completion} skillsCount={resume?.skills.length ?? 0} />
        <div className="flex flex-col gap-5">
          <ResumeSnapshot resume={resume} resumeReady={resumeReady} hasFile={Boolean(profile?.resumeUrl)} />
          <TelegramConnect
            variant="compact"
            onStatusChange={onTelegramStatus}
            openHref={nav.href("telegram")}
            onOpen={() => nav.go("telegram")}
          />
        </div>
      </div>

      <ApplicationList list={applications} variant="recent" />
      <SavedJobs list={favorites} token={token} variant="recent" />
    </div>
  );
}

const TONES = {
  blue: "bg-[rgb(59_130_246/0.12)] text-[#2563EB] dark:text-[#60A5FA]",
  violet: "bg-[rgb(139_92_246/0.13)] text-[#7C3AED] dark:text-[#A78BFA]",
  pink: "bg-[rgb(236_72_153/0.12)] text-[#DB2777] dark:text-[#F472B6]",
};

function IconTile({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`flex h-[38px] w-[38px] items-center justify-center rounded-xl ${TONES[tone]}`} aria-hidden>
      {children}
    </span>
  );
}

function SummaryCard({
  tab,
  step,
  scrollTo,
  label,
  icon,
  value,
  accent = "text-ink",
  small = false,
}: {
  tab: ProfileTab;
  step?: number;
  scrollTo?: string;
  label: string;
  icon: React.ReactNode;
  value: string | null;
  accent?: string;
  small?: boolean;
}) {
  const nav = useProfileNav();
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        {icon}
        <IconArrowRight
          size={16}
          className="text-dusk/0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-signal"
        />
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase leading-snug tracking-[0.08em] text-dusk">{label}</p>
        {value === null ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <p
            className={`mt-1 font-display font-extrabold leading-tight tracking-tight tabular-nums ${accent} ${
              small ? "text-[19px] sm:text-[21px]" : "text-[24px] sm:text-[28px]"
            }`}
          >
            {value}
          </p>
        )}
      </div>
    </>
  );
  const className =
    "group flex h-full flex-col justify-between rounded-3xl border border-line bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/30 hover:shadow-card-hover sm:p-5";

  if (scrollTo) {
    return (
      <a
        href={`#${scrollTo}`}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <TabLink href={nav.href(tab, step)} onNavigate={() => nav.go(tab, step)} className={className}>
      {content}
    </TabLink>
  );
}

/** Rezyume qisqacha holati — qaysi qism to'la, qaysi biri bo'sh. */
function ResumeSnapshot({
  resume,
  resumeReady,
  hasFile,
}: {
  resume: ResumeData | null;
  resumeReady: boolean;
  hasFile: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const nav = useProfileNav();
  const hub = t.profileHub;
  const rows: { label: string; value: string; tab: ProfileTab; step?: number; ok: boolean }[] = [
    { label: t.resume.jobTitle, value: resume?.title || hub.resume.notFilled, tab: "resume", step: 2, ok: Boolean(resume?.title) },
    {
      label: t.resume.experience,
      value: String(resume?.experience.length ?? 0),
      tab: "experience",
      ok: (resume?.experience.length ?? 0) > 0,
    },
    {
      label: t.resume.education,
      value: String(resume?.education.length ?? 0),
      tab: "education",
      ok: (resume?.education.length ?? 0) > 0,
    },
    { label: t.resume.skills, value: String(resume?.skills.length ?? 0), tab: "skills", ok: (resume?.skills.length ?? 0) > 0 },
    {
      label: t.resume.desiredSalary,
      value: resume?.desiredSalary ? formatNumber(resume.desiredSalary, locale) : hub.resume.notFilled,
      tab: "resume",
      step: 2,
      ok: Boolean(resume?.desiredSalary),
    },
    { label: "PDF", value: hasFile ? "✓" : "—", tab: "resume", step: 6, ok: hasFile },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader
        title={hub.summary.resume}
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              resumeReady ? "bg-growth/10 text-growth" : "bg-gold/15 text-gold-deep"
            }`}
          >
            {resumeReady ? hub.summary.resumeReady : hub.summary.resumeIncomplete}
          </span>
        }
      />
      <dl className="mt-4 divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="flex min-w-0 items-center gap-2 text-[13.5px] text-dusk">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.ok ? "bg-growth" : "bg-line"}`} aria-hidden />
              <span className="truncate">{row.label}</span>
            </dt>
            <dd className="min-w-0">
              <TabLink
                href={nav.href(row.tab, row.step)}
                onNavigate={() => nav.go(row.tab, row.step)}
                className={`block max-w-[190px] truncate text-right text-[13.5px] font-semibold tabular-nums transition-colors hover:text-signal ${
                  row.ok ? "text-ink" : "text-dusk/80"
                }`}
              >
                {row.value}
              </TabLink>
            </dd>
          </div>
        ))}
      </dl>
      <TabLink
        href={nav.href("resume", 6)}
        onNavigate={() => nav.go("resume", 6)}
        className="group mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-signal hover:text-signal-dark"
      >
        {hub.header.viewResume}
        <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </TabLink>
    </Card>
  );
}
