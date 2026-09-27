import React, { useEffect, useRef } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { regionDisplayName } from "../../lib/format.js";
import type { Profile, ResumeData } from "../../lib/types.js";
import type { ProfileTab } from "../../lib/profile/tabs.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { Button, Card, ProgressBar, TabLink, buttonClass } from "./ui.js";
import { ProfessionalInfo } from "./ProfessionalInfo.js";
import { ExperienceList } from "./ExperienceList.js";
import { EducationList } from "./EducationList.js";
import { SkillsEditor } from "./SkillsEditor.js";
import { ResumePreview } from "./ResumePreview.js";
import { ResumeFile } from "./ResumeFile.js";
import { IconArrowLeft, IconArrowRight, IconCheck, IconFile, IconMail, IconPencil, IconPhone, IconPin, IconUser } from "./icons.js";

const STEPS = ["personal", "professional", "experience", "education", "skills", "review"] as const;
type StepKey = (typeof STEPS)[number];
export const RESUME_STEP_COUNT = STEPS.length;

/**
 * Rezyume — bosqichma-bosqich. Har bosqich o'z ma'lumotini alohida saqlaydi,
 * shuning uchun istalgan bosqichga to'g'ridan-to'g'ri o'tish mumkin
 * (bosqich raqami URL'da: `?tab=resume&step=3`).
 */
export function ResumeWizard({
  step,
  token,
  profile,
  resume,
  email,
  saveResume,
  setResumeUrl,
}: {
  step: number;
  token: string;
  profile: Profile | null;
  resume: ResumeData | null;
  email: string;
  saveResume: (patch: Partial<ResumeData>) => Promise<ResumeData>;
  setResumeUrl: (url: string | null) => void;
}) {
  const t = useT();
  const nav = useProfileNav();
  const r = t.profileHub.resume;
  const current = Math.min(Math.max(step || 1, 1), STEPS.length);
  const key: StepKey = STEPS[current - 1];

  /**
   * Audit R3, gap5-3: bosqich almashganda bosqich mazmuni qayta chiziladi va
   * fokus `<body>` ga tushib ketadi. Sarlavhaga fokus beriladi (birinchi
   * renderda emas — sahifa ochilganda fokus o'g'irlanmasin), bosqich raqami
   * esa `role="status"` orqali e'lon qilinadi.
   */
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [current]);

  const done: Record<StepKey, boolean> = {
    personal: Boolean(profile?.firstName?.trim() && profile?.lastName?.trim() && profile?.regionId),
    professional: Boolean(resume?.title?.trim() && resume?.summary?.trim()),
    experience: (resume?.experience.length ?? 0) > 0,
    education: (resume?.education.length ?? 0) > 0,
    skills: (resume?.skills.length ?? 0) > 0,
    review: false,
  };

  const goStep = (n: number) => nav.go("resume", n);
  const back = current > 1 ? () => goStep(current - 1) : undefined;
  const next = current < STEPS.length ? () => goStep(current + 1) : undefined;

  return (
    <Card as="section" className="overflow-hidden" aria-labelledby="resume-wizard-title">
      <div className="border-b border-line px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
              <IconFile size={19} />
            </span>
            <div>
              <h1
                id="resume-wizard-title"
                ref={titleRef}
                tabIndex={-1}
                className="font-display text-[17px] font-bold leading-tight tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
              >
                {r.title}
              </h1>
              <p className="mt-1 text-[13.5px] text-dusk">{r.subtitle}</p>
            </div>
          </div>
          <span
            role="status"
            aria-live="polite"
            className="rounded-full bg-surface-2 px-3 py-1 font-mono text-[12px] font-semibold tabular-nums text-ink/80"
          >
            {r.stepOf(current, STEPS.length)}
          </span>
        </div>

        {/* Mobil: joriy bosqich nomi + chiziq */}
        <div className="mt-5 sm:hidden">
          <p className="text-[13px] font-semibold text-ink">
            <span className="text-signal">{r.stepLabel(current)}</span> — {r.steps[key]}
          </p>
          <div className="mt-2.5">
            <ProgressBar value={Math.round((current / STEPS.length) * 100)} label={r.stepOf(current, STEPS.length)} />
          </div>
        </div>

        {/* Planshet/desktop: to'liq stepper */}
        <ol className="mt-6 hidden grid-cols-6 gap-2 sm:grid">
          {STEPS.map((stepKey, i) => {
            const n = i + 1;
            const active = n === current;
            const complete = done[stepKey] && !active;
            return (
              <li key={stepKey} className="relative">
                {i > 0 && (
                  <span
                    className={`absolute right-[calc(50%+18px)] top-[15px] h-0.5 w-[calc(100%-28px)] rounded-full ${
                      n <= current ? "bg-signal/40" : "bg-line"
                    }`}
                    aria-hidden
                  />
                )}
                <TabLink
                  href={nav.href("resume", n)}
                  onNavigate={() => goStep(n)}
                  aria-current={active ? "step" : undefined}
                  className="group relative flex flex-col items-center gap-2 rounded-xl px-1 pb-1 text-center"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold tabular-nums transition-all ${
                      active
                        ? "bg-signal text-white shadow-[0_0_0_4px_rgb(var(--signal)/0.15)]"
                        : complete
                          ? "bg-growth text-white"
                          : "border-2 border-line bg-surface text-dusk group-hover:border-signal/50 group-hover:text-signal"
                    }`}
                  >
                    {complete ? <IconCheck size={15} /> : n}
                    {/* Audit R3, gap5-3: belgi raqamni yashirmasin, "bajarildi" ham eshitilsin */}
                    {complete && (
                      <span className="sr-only">
                        {n} ({t.vacancyForm.stepDone})
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[12.5px] leading-tight ${
                      active ? "font-semibold text-ink" : "font-medium text-dusk group-hover:text-ink"
                    }`}
                  >
                    {r.steps[stepKey]}
                  </span>
                </TabLink>
              </li>
            );
          })}
        </ol>
      </div>

      <div key={key} className="animate-fade-in px-5 py-6 sm:px-7">
        {key === "personal" && (
          <>
            <PersonalSummary profile={profile} email={email} />
            <StepFooter back={back} next={next} />
          </>
        )}

        {key === "professional" && (
          <>
            <p className="mb-5 text-[13.5px] leading-relaxed text-dusk">{r.professionalHint}</p>
            <ProfessionalInfo
              resume={resume}
              saveResume={saveResume}
              footer={({ save, dirty, saving, status }) => (
                <StepFooter
                  back={back}
                  status={status}
                  nextLabel={dirty ? `${t.profile.save} · ${r.next}` : r.next}
                  nextLoading={saving}
                  next={async () => {
                    if (await save()) goStep(current + 1);
                  }}
                />
              )}
            />
          </>
        )}

        {key === "experience" && (
          <>
            <ExperienceList items={resume?.experience ?? []} saveResume={saveResume} headingAs="h2" />
            <StepFooter back={back} next={next} />
          </>
        )}

        {key === "education" && (
          <>
            <EducationList items={resume?.education ?? []} saveResume={saveResume} headingAs="h2" />
            <StepFooter back={back} next={next} />
          </>
        )}

        {key === "skills" && (
          <>
            <SkillsEditor skills={resume?.skills ?? []} saveResume={saveResume} headingAs="h2" />
            <StepFooter back={back} next={next} />
          </>
        )}

        {key === "review" && (
          <>
            <p className="mb-4 text-[13.5px] text-dusk">{r.reviewHint}</p>
            <ResumePreview profile={profile} resume={resume} email={email} />
            <div className="mt-6">
              <ResumeFile token={token} resumeUrl={profile?.resumeUrl ?? null} onChange={setResumeUrl} />
            </div>
            <StepFooter back={back} />
          </>
        )}
      </div>
    </Card>
  );
}

function StepFooter({
  back,
  next,
  nextLabel,
  nextLoading,
  status,
}: {
  back?: () => void;
  next?: () => void | Promise<void>;
  nextLabel?: string;
  nextLoading?: boolean;
  status?: React.ReactNode;
}) {
  const t = useT();
  const r = t.profileHub.resume;
  return (
    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {back ? (
          <Button variant="ghost" onClick={back}>
            <IconArrowLeft size={16} /> {r.back}
          </Button>
        ) : (
          <span />
        )}
        {status}
      </div>
      {next && (
        <Button onClick={() => void next()} loading={nextLoading} className="sm:min-w-[160px]">
          {nextLabel ?? r.next}
          {!nextLoading && <IconArrowRight size={16} />}
        </Button>
      )}
    </div>
  );
}

/** 1-bosqich: shaxsiy ma'lumotlar profil bo'limida tahrirlanadi — bu yerda faqat ko'rinish. */
function PersonalSummary({ profile, email }: { profile: Profile | null; email: string }) {
  const t = useT();
  const { locale } = useLocale();
  const nav = useProfileNav();
  const hub = t.profileHub;
  const name = [profile?.firstName, profile?.lastName].filter((x) => x?.trim()).join(" ");
  const rows: { icon: React.ReactNode; label: string; value: string | null | undefined; tab: ProfileTab }[] = [
    { icon: <IconUser size={16} />, label: `${t.profile.firstName} / ${t.profile.lastName}`, value: name, tab: "personal" },
    // Audit R3, i18n-4: hudud nomi ru/en da ham tarjima qilinadi
    { icon: <IconPin size={16} />, label: t.profile.region, value: regionDisplayName(locale, profile?.regionName), tab: "personal" },
    { icon: <IconPhone size={16} />, label: t.profile.phone, value: profile?.phone, tab: "personal" },
    { icon: <IconMail size={16} />, label: t.profile.email, value: email, tab: "settings" },
  ];

  return (
    <div>
      <p className="text-[13.5px] leading-relaxed text-dusk">{hub.resume.personalStepHint}</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-dusk ring-1 ring-line">
              {row.icon}
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-dusk">{row.label}</dt>
              <dd className={`truncate text-[14px] font-semibold ${row.value ? "text-ink" : "italic text-dusk/80"}`}>
                {row.value || hub.resume.notFilled}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      <TabLink
        href={nav.href("personal")}
        onNavigate={() => nav.go("personal")}
        className={`${buttonClass("secondary", "sm")} mt-4`}
      >
        <IconPencil size={14} /> {hub.resume.openPersonal}
      </TabLink>
    </div>
  );
}
