import React from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { formatNumber, regionDisplayName } from "../../lib/format.js";
import { formatYearMonth } from "../../lib/profile/format.js";
import type { Profile, ResumeData } from "../../lib/types.js";
import { IconMail, IconPhone, IconPin } from "./icons.js";

/** Rezyume ish beruvchiga qanday ko'rinsa — shunday: hujjat uslubidagi ko'rinish. */
export function ResumePreview({
  profile,
  resume,
  email,
}: {
  profile: Profile | null;
  resume: ResumeData | null;
  email: string;
}) {
  const t = useT();
  const { locale } = useLocale();
  const hub = t.profileHub;
  const name = [profile?.firstName, profile?.lastName].filter((x) => x?.trim()).join(" ");
  const missing = <span className="italic text-dusk/80">{hub.resume.notFilled}</span>;
  // Audit R3, i18n-4: hudud nomi joriy tilda
  const region = regionDisplayName(locale, profile?.regionName);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header className="border-b border-line bg-gradient-to-br from-signal-soft/70 to-transparent px-5 py-5 sm:px-7 sm:py-6">
        <p className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-ink">{name || missing}</p>
        <p className="mt-1 text-[15px] font-semibold text-signal">{resume?.title || profile?.headline || missing}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-dusk">
          {region && (
            <span className="inline-flex items-center gap-1.5">
              <IconPin size={14} /> {region}
            </span>
          )}
          {profile?.phone && (
            <span className="inline-flex items-center gap-1.5">
              <IconPhone size={14} /> {profile.phone}
            </span>
          )}
          {email && (
            <span className="inline-flex items-center gap-1.5">
              <IconMail size={14} /> {email}
            </span>
          )}
        </div>
        {resume?.desiredSalary ? (
          <p className="mt-3 inline-flex rounded-full bg-growth/10 px-3 py-1 text-[13px] font-semibold text-growth">
            {formatNumber(resume.desiredSalary, locale)} {hub.resume.perMonth}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-6 px-5 py-5 sm:px-7 sm:py-6">
        <PreviewSection title={t.resume.summary}>
          {resume?.summary ? (
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink/85">{resume.summary}</p>
          ) : (
            missing
          )}
        </PreviewSection>

        <PreviewSection title={t.resume.experience}>
          {resume?.experience.length ? (
            <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-5">
              {resume.experience.map((item, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-signal" aria-hidden />
                  <p className="text-[14.5px] font-semibold text-ink">{item.position}</p>
                  <p className="text-[13px] text-ink/75">
                    {item.companyName} · {formatYearMonth(item.startDate, locale)} —{" "}
                    {item.isCurrent || !item.endDate ? hub.resume.present : formatYearMonth(item.endDate, locale)}
                  </p>
                  {item.description && (
                    <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-dusk">{item.description}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            missing
          )}
        </PreviewSection>

        <PreviewSection title={t.resume.education}>
          {resume?.education.length ? (
            <ul className="flex flex-col gap-3">
              {resume.education.map((item, i) => (
                <li key={i}>
                  <p className="text-[14.5px] font-semibold text-ink">{item.institution}</p>
                  <p className="text-[13px] text-ink/75">
                    {[item.field, item.degree].filter(Boolean).join(" · ")}
                    {(item.field || item.degree) && " · "}
                    {item.startYear} — {item.endYear ?? hub.resume.present}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            missing
          )}
        </PreviewSection>

        <PreviewSection title={t.resume.skills}>
          {resume?.skills.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {resume.skills.map((skill) => (
                <li key={skill} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-ink/85">
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            missing
          )}
        </PreviewSection>
      </div>
    </article>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dusk">{title}</h4>
      {children}
    </section>
  );
}
