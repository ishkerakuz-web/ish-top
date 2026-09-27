import React, { useEffect, useState } from "react";
import { CountUp } from "../../components/CountUp.js";
import { HeroBackdrop } from "../../components/HeroBackdrop.js";
import { useT, useHref } from "../../lib/i18n/index.js";
import { useRedirectRole } from "../../lib/useRoleGuard.js";
import { fetchStats } from "../../lib/api.js";
import type { Stats } from "../../lib/types.js";

export default function Page() {
  const t = useT();
  const l = useHref();
  const benefits = t.employerLanding.benefits;
  // Raqamlar — bazadagi haqiqiy ko'rsatkichlar (audit ISSUE-015: ilgari "3204+ / 48000+" qattiq yozilgan edi).
  // So'rov bajarilmasa blok chizilmaydi.
  const [stats, setStats] = useState<Stats | null>(null);

  // Tizimga kirgan ish beruvchi uchun marketing sahifa keraksiz — profilga o'tadi.
  useRedirectRole("employer", "/profile");

  useEffect(() => {
    let alive = true;
    void fetchStats().then((next) => {
      if (alive) setStats(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface-2 to-paper" />
        <HeroBackdrop />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
          {/* CSS animatsiya — SSR paint bilanoq boshlanadi (LCP hidratsiyani kutmaydi) */}
          <h1 className="animate-fade-up font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            {t.employerLanding.heroTitle1}{" "}
            <span className="text-shine">{t.employerLanding.heroHighlight}</span>{" "}
            {t.employerLanding.heroTitle2}
          </h1>
          <p
            style={{ animationDelay: "50ms" }}
            className="mt-5 max-w-lg animate-fade-up text-base leading-relaxed text-dusk sm:text-lg"
          >
            {t.employerLanding.heroSubtitle}
          </p>
          <div style={{ animationDelay: "100ms" }} className="mt-8 animate-fade-up">
            <a
              href={l("/signup?role=employer")}
              className="glow-signal inline-block rounded-xl bg-signal px-7 py-3 text-sm font-semibold text-white hover:bg-signal-dark active:scale-[0.98]"
            >
              {t.employerLanding.heroCta}
            </a>
          </div>

          </div>

          {stats && (
            <div className="mt-14 grid grid-cols-2 border-t border-line">
              <div className="py-6 pr-4">
                <div className="font-display text-2xl font-bold tabular-nums text-ink sm:text-[2rem]">
                  <CountUp value={stats.companies} />
                </div>
                <div className="mt-2 text-xs text-dusk sm:text-[13px]">{t.employerLanding.statCompanies}</div>
              </div>
              <div className="border-l border-line py-6 pl-6 sm:pl-10">
                <div className="font-display text-2xl font-bold tabular-nums text-ink sm:text-[2rem]">
                  <CountUp value={stats.vacancies} />
                </div>
                <div className="mt-2 text-xs text-dusk sm:text-[13px]">{t.employerLanding.statVacancies}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              style={{ animationDelay: `${i * 80}ms` }}
              className="animate-fade-up rounded-2xl border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-card-hover"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-soft font-display text-sm font-bold text-signal">
                {i + 1}
              </div>
              <p className="mt-4 font-display text-base font-semibold text-ink">{b.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-dusk">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface-2 px-8 py-12 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_20%_20%,rgba(30,136,229,0.12),transparent_60%)]" />
          <h2 className="relative font-display text-2xl font-bold text-ink sm:text-3xl">
            {t.employerLanding.bottomTitle}
          </h2>
          <p className="relative mx-auto mt-2 max-w-sm text-dusk">{t.employerLanding.bottomDesc}</p>
          <a
            href={l("/signup")}
            className="relative mt-6 inline-block rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-signal-dark active:scale-[0.98]"
          >
            {t.employerLanding.bottomCta}
          </a>
        </div>
      </section>
    </div>
  );
}
