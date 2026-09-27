import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { useAuth } from "../../components/AuthContext.js";
import { Skeleton } from "../../components/Skeleton.js";
import { EmployerCompanyForm } from "../../components/EmployerCompanyForm.js";
import { CompanyVerificationCard } from "../../components/CompanyVerificationCard.js";
import { TelegramConnect } from "../../components/TelegramConnect.js";
import { fetchMyApplications, fetchMyCompany, fetchRegionsStrict } from "../../lib/api.js";
import { fetchFavoritesStrict } from "../../lib/apiExtra.js";
import { loginHrefWithReturn } from "../../lib/auth/returnTo.js";
import type { CurrentUser, MyCompany, Region, TelegramStatus } from "../../lib/types.js";
import { useProfileTab, type ProfileTab } from "../../lib/profile/tabs.js";
import { computeCompletion, isResumeReady, SKILLS_TARGET } from "../../lib/profile/completion.js";
import { useProfileCore, useRemoteList } from "../../lib/profile/useProfileData.js";
import { ProfileNavProvider } from "../../components/profile/ProfileNavContext.js";
import { ProfileHeader } from "../../components/profile/ProfileHeader.js";
import { ProfileNav } from "../../components/profile/ProfileNav.js";
import { ProfileOverview } from "../../components/profile/ProfileOverview.js";
import { PersonalInfo } from "../../components/profile/PersonalInfo.js";
import { ResumeWizard } from "../../components/profile/ResumeWizard.js";
import { ExperienceList } from "../../components/profile/ExperienceList.js";
import { EducationList } from "../../components/profile/EducationList.js";
import { SkillsEditor } from "../../components/profile/SkillsEditor.js";
import { SavedJobs } from "../../components/profile/SavedJobs.js";
import { AccountSettings } from "../../components/profile/AccountSettings.js";
import { StaffAccount } from "../../components/profile/StaffAccount.js";
import { Card, ErrorState } from "../../components/profile/ui.js";

export default function Page() {
  const l = useHref();
  const { status, accessToken, user } = useAuth();

  useEffect(() => {
    if (status === "guest" || (status === "authed" && !accessToken)) {
      window.location.assign(loginHrefWithReturn(l("/login")));
    }
  }, [status, accessToken, l]);

  if (status !== "authed" || !accessToken || !user) return <HubSkeleton />;
  if (user.role === "employer") return <EmployerProfile token={accessToken} />;
  // Admin va kontent jamoasi — hisob sahifasi (nomzod karyera markazi ularga to'g'ri kelmaydi,
  // nomzodga xos so'rovlar 403 berib sahifa xatoda qolardi; audit: profile-1)
  if (user.role !== "job_seeker") return <StaffAccount token={accessToken} user={user} />;
  return <SeekerHub token={accessToken} user={user} />;
}

/* ====================================================================
 * Nomzod — karyera markazi
 * ==================================================================== */

function SeekerHub({ token, user }: { token: string; user: CurrentUser }) {
  const t = useT();
  const { tab, step, setTab } = useProfileTab();
  const core = useProfileCore(token, t.resume.jobTitle);

  const applicationsLoader = useCallback(() => fetchMyApplications(token), [token]);
  // Xato bo'sh "Saqlanganlar" bo'lib ko'rinmasin (audit ISSUE-022)
  const favoritesLoader = useCallback(() => fetchFavoritesStrict(token), [token]);
  const applications = useRemoteList(applicationsLoader);
  const favorites = useRemoteList(favoritesLoader);

  const completion = useMemo(() => computeCompletion(core.profile, core.resume), [core.profile, core.resume]);
  const resumeReady = isResumeReady(core.resume);

  // Telegram orqali telefon tasdiqlangach profil (header, to'liqlik) darhol yangilansin.
  const { profile, refreshProfile } = core;
  const onTelegramStatus = useCallback(
    (s: TelegramStatus) => {
      if (profile && s.phoneVerified !== profile.isPhoneVerified) void refreshProfile();
    },
    [profile, refreshProfile]
  );

  // Bo'lim almashganda kontent boshi ko'rinmay qolgan bo'lsa, unga yumshoq qaytamiz.
  const contentRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = contentRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 90) window.scrollTo({ top: window.scrollY + top - 140, behavior: "smooth" });
  }, [tab, step]);

  if (core.status === "loading") return <HubSkeleton />;
  if (core.status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card className="p-6">
          <ErrorState onRetry={() => void core.reload()} />
        </Card>
      </div>
    );
  }

  const email = core.profile?.email ?? user.email;
  const resume = core.resume;
  const counts: Partial<Record<ProfileTab, number>> = {
    applications: applications.status === "ready" ? applications.items.length : undefined,
    saved: favorites.status === "ready" ? favorites.items.length : undefined,
  };
  const byKey = Object.fromEntries(completion.items.map((i) => [i.key, i.done]));
  const attention: Partial<Record<ProfileTab, boolean>> = {
    personal: !(byKey.name && byKey.region && byKey.headline),
    resume: !byKey.resume,
    experience: !byKey.experience,
    education: !byKey.education,
    skills: (resume?.skills.length ?? 0) < SKILLS_TARGET,
    telegram: !byKey.phone,
  };

  let content: React.ReactNode;
  switch (tab) {
    case "personal":
      content = (
        <PersonalInfo
          profile={core.profile}
          regions={core.regions}
          email={email}
          userName={{ firstName: user.firstName, lastName: user.lastName }}
          saveProfile={core.saveProfile}
        />
      );
      break;
    case "resume":
      content = (
        <ResumeWizard
          step={step ?? 1}
          token={token}
          profile={core.profile}
          resume={resume}
          email={email}
          saveResume={core.saveResume}
          setResumeUrl={core.setResumeUrl}
        />
      );
      break;
    case "experience":
      content = (
        <Card className="p-5 sm:p-7">
          <ExperienceList items={resume?.experience ?? []} saveResume={core.saveResume} headingAs="h1" />
        </Card>
      );
      break;
    case "education":
      content = (
        <Card className="p-5 sm:p-7">
          <EducationList items={resume?.education ?? []} saveResume={core.saveResume} headingAs="h1" />
        </Card>
      );
      break;
    case "skills":
      content = (
        <Card className="p-5 sm:p-7">
          <SkillsEditor skills={resume?.skills ?? []} saveResume={core.saveResume} headingAs="h1" />
        </Card>
      );
      break;
    case "applications":
      // Eski `/profile?tab=applications` havolalari yangi sahifaga o'tadi
      content = <ApplicationsMoved />;
      break;
    case "saved":
      content = <SavedJobs list={favorites} token={token} variant="full" />;
      break;
    case "telegram":
      content = <TelegramConnect variant="panel" onStatusChange={onTelegramStatus} />;
      break;
    case "settings":
      content = <AccountSettings profile={core.profile} email={email} />;
      break;
    default:
      content = (
        <ProfileOverview
          token={token}
          profile={core.profile}
          resume={resume}
          resumeReady={resumeReady}
          completion={completion}
          applications={applications}
          favorites={favorites}
          onTelegramStatus={onTelegramStatus}
        />
      );
  }

  return (
    <ProfileNavProvider go={setTab}>
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7">
        <ProfileHeader profile={core.profile} email={email} completion={completion} />

        <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-6 lg:grid-cols-[252px_minmax(0,1fr)] lg:gap-6">
          <ProfileNav active={tab} counts={counts} attention={attention} />
          <div ref={contentRef} key={tab} className="min-w-0 animate-fade-in">
            {content}
          </div>
        </div>
      </div>
    </ProfileNavProvider>
  );
}

function ApplicationsMoved() {
  const l = useHref();
  useEffect(() => {
    window.location.replace(l("/applications"));
  }, [l]);
  return <Skeleton className="h-[360px] rounded-3xl" />;
}

function HubSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7" aria-busy="true">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
        <div className="flex items-center gap-5">
          <Skeleton className="h-16 w-16 rounded-2xl sm:h-[76px] sm:w-[76px]" />
          <div className="flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-2.5 h-4 w-64 max-w-full" />
            <Skeleton className="mt-2.5 h-3.5 w-40" />
          </div>
        </div>
        <Skeleton className="mt-6 h-[62px] w-full rounded-2xl" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[252px_minmax(0,1fr)]">
        <Skeleton className="hidden h-[480px] rounded-3xl lg:block" />
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[128px] rounded-3xl" />
            ))}
          </div>
          <Skeleton className="h-[360px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
 * Ish beruvchi — kompaniya profili (avvalgi xatti-harakat saqlangan)
 * ==================================================================== */

function EmployerProfile({ token }: { token: string }) {
  const t = useT();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const [regions, setRegions] = useState<Region[]>([]);
  const [company, setCompany] = useState<MyCompany | null>(null);

  // Kompaniya yoki hududlar yuklanmasa bo'sh forma chizilmaydi: saqlansa mavjud kompaniya
  // ma'lumotlari bo'sh qiymatlar bilan ustidan yozilardi (audit ISSUE-018)
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    Promise.all([fetchRegionsStrict(), fetchMyCompany(token)]).then(
      ([r, c]) => {
        if (cancelled) return;
        setRegions(r);
        setCompany(c);
        setState("ready");
      },
      () => {
        if (!cancelled) setState("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  if (state === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card className="p-6">
          <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
        </Card>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-3 h-4 w-72" />
        <Skeleton className="mt-8 h-72 w-full rounded-2xl" />
        <Skeleton className="mt-5 h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const initial = (company?.name || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex animate-fade-up items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-signal to-[#8B5CF6] font-display text-2xl font-bold text-white shadow-card">
          {initial}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.employerProfile.title}</h1>
          <p className="mt-0.5 text-sm text-dusk">{t.employerProfile.subtitle}</p>
        </div>
      </div>

      <EmployerCompanyForm token={token} regions={regions} initial={company} />
      <CompanyVerificationCard token={token} company={company} />
      <TelegramConnect />
    </div>
  );
}
