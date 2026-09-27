import React from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { SearchBar } from "../../components/SearchBar.js";
import { HeroBackdrop } from "../../components/HeroBackdrop.js";
import { CountUp } from "../../components/CountUp.js";
import { CategoryCard, CATEGORY_ICONS } from "../../components/CategoryCard.js";
import { VacancyCard } from "../../components/VacancyCard.js";
import { CompanyCard } from "../../components/CompanyCard.js";
import { useT, useLocale, useHref } from "../../lib/i18n/index.js";
import { CATEGORIES, CATEGORY_NAMES } from "../../lib/i18n/categories.js";
import { useRedirectRole } from "../../lib/useRoleGuard.js";
import { useReveal } from "../../lib/useReveal.js";
import { useFavorites } from "../../lib/useFavorites.js";

/** Kategoriya chiplari uchun rang juftliklari (ikonka tint / ikonka rangi).
 *  Tintlar alpha bilan — qorong'i rejimda ham o'z-o'zidan mos tushadi. */
const CHIP_HUES: Record<string, { tint: string; icon: string }> = {
  it: { tint: "rgb(59 130 246 / 0.12)", icon: "#3B82F6" },
  savdo: { tint: "rgb(16 185 129 / 0.13)", icon: "#10B981" },
  marketing: { tint: "rgb(245 158 11 / 0.14)", icon: "#F59E0B" },
  moliya: { tint: "rgb(124 58 237 / 0.12)", icon: "#8B5CF6" },
  qurilish: { tint: "rgb(202 138 4 / 0.14)", icon: "#CA8A04" },
  turizm: { tint: "rgb(236 72 153 / 0.12)", icon: "#EC4899" },
};

export default function Page() {
  const { stats, vacancies, companies, categoryCounts } = useData<Awaited<ReturnType<typeof data>>>();
  const t = useT();
  const { locale } = useLocale();
  const l = useHref();
  const names = CATEGORY_NAMES[locale];
  const favorites = useFavorites();

  // Bosh sahifa ish-izlovchiga tegishli (qidiruv, vakansiyalar) — ish beruvchi
  // o'zining "bosh sahifasi"ga: xodim qidirish bo'limiga o'tadi
  useRedirectRole("employer", "/employer/candidates");

  return (
    <div>
      {/* HERO — tasdiqlangan referens: osmon fon, o'ngda foto, chapda kontent */}
      <section className="relative overflow-hidden">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          {/* Yuqori qism — foto shu wrapperning pastiga langarlangan */}
          <div className="relative">
            {/* O'ng foto blok: yigit + Toshkent minorasi + o'sish strelkasi.
                Fon shaffof (bitta webp) — kunduzgi va tungi rejimga birdek
                singiydi; chekkalarni hero-photo maskasi yumshatadi */}
            <img
              src="/hero-cutout.webp"
              alt=""
              width={1400}
              height={788}
              loading="lazy"
              decoding="async"
              className="hero-photo pointer-events-none absolute -right-2 bottom-0 hidden w-[760px] lg:block xl:w-[840px]"
            />

            {/* Chap kontent */}
            <div className="relative z-[2] pt-10 sm:pt-14">
              <div className="max-w-3xl">
              <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-signal/20 bg-signal-soft/90 px-4 py-2">
                <svg width="15" height="15" viewBox="0 0 24 24" className="fill-signal" aria-hidden>
                  <path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 2.8Z" />
                </svg>
                <span className="text-[13.5px] font-semibold text-signal">{t.home.heroBadge}</span>
              </span>

              {/* CSS animatsiya — SSR paint bilanoq boshlanadi (LCP hidratsiyani kutmaydi) */}
              <h1
                style={{ animationDelay: "40ms" }}
                className="mt-4 animate-fade-up font-display text-[2.7rem] font-extrabold leading-[1.06] tracking-tight text-ink sm:text-6xl xl:text-[4.5rem]"
              >
                {t.home.heroTitle1} <span className="block text-shine">{t.home.heroTitle2}</span>
              </h1>

              <p
                style={{ animationDelay: "80ms" }}
                className="mt-4 max-w-xl animate-fade-up text-base font-medium leading-relaxed text-dusk sm:text-lg"
              >
                {t.home.heroSubtitle}
              </p>

              </div>

              <div className="mt-7 max-w-[720px]">
                <SearchBar />
              </div>

              {/* Rangli ikonkali kategoriya chiplari */}
              <div
                style={{ animationDelay: "160ms" }}
                className="mt-4 flex animate-fade-up flex-wrap items-center gap-2 pb-1"
              >
                {CATEGORIES.slice(0, 5).map((c) => {
                  const hue = CHIP_HUES[c.slug] ?? CHIP_HUES.it;
                  return (
                    <a
                      key={c.slug}
                      href={l(`/vacancies?category=${c.slug}`)}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-surface py-2 pl-2 pr-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-card-hover"
                    >
                      <span
                        style={{ background: hue.tint, color: hue.icon }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                          {CATEGORY_ICONS[c.slug] ?? CATEGORY_ICONS.it}
                        </svg>
                      </span>
                      <span className="text-[13.5px] font-semibold text-ink/85">{names[c.slug]}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Statistika kartasi — pastel ikonka + rangli chiziqcha. API javob bermasa umuman chizilmaydi (0 ko'rsatilmaydi) */}
          <div className="relative">
            {stats && (
            <div
              style={{ animationDelay: "220ms" }}
              className="relative z-[2] mt-8 grid animate-fade-up gap-6 rounded-2xl border border-line bg-surface/95 px-6 py-5 shadow-card backdrop-blur sm:grid-cols-3 sm:gap-0 sm:px-2"
            >
              <Stat
                value={stats.vacancies}
                label={t.home.statVacancies}
                bar="#3B82F6"
                tint="rgb(59 130 246 / 0.12)"
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" aria-hidden>
                    <rect x="3.5" y="7" width="17" height="12.5" rx="2" />
                    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12h17" />
                  </svg>
                }
              />
              <Stat
                value={stats.companies}
                label={t.home.statCompanies}
                bar="linear-gradient(90deg,#8B5CF6,#EC4899)"
                tint="rgb(139 92 246 / 0.12)"
                divider
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 20.5h16M6.5 20.5v-13A1.5 1.5 0 0 1 8 6h5a1.5 1.5 0 0 1 1.5 1.5v13M17.5 20.5V11h-3" />
                    <path d="M9 9.5h2.5M9 12.5h2.5M9 15.5h2.5" />
                  </svg>
                }
              />
              <Stat
                value={stats.applicationsToday}
                label={t.home.statApplicationsToday}
                bar="#10B981"
                tint="rgb(16 185 129 / 0.13)"
                divider
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20.5 3.5L10 13.9M20.5 3.5l-6.7 17-3.8-6.6-6.5-3.9 17-6.5Z" />
                  </svg>
                }
              />
            </div>
            )}

            {/* Top kompaniyalar lentasi */}
            {companies && companies.length > 0 && (
              <div
                style={{ animationDelay: "280ms" }}
                className="relative z-[2] mb-2 mt-4 animate-fade-up rounded-2xl border border-line bg-surface/95 px-5 pb-5 pt-4 shadow-card backdrop-blur"
              >
                <p className="mb-3 text-[15px] font-bold text-ink">{t.home.topCompanies}</p>
                <div className="flex items-stretch gap-2.5 overflow-x-auto pb-0.5">
                  {companies.slice(0, 6).map((c) => (
                    <a
                      key={c.slug}
                      href={l(`/companies/${c.slug}`)}
                      className="flex min-w-[120px] flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 py-3.5 font-display text-[15px] font-bold text-ink/80 transition-colors hover:border-signal/40 hover:text-signal"
                    >
                      <span className="truncate">{c.name}</span>
                    </a>
                  ))}
                  <a
                    href={l("/companies")}
                    className="flex min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl border border-signal/20 bg-signal-soft px-4 py-3.5 text-[13.5px] font-bold text-signal transition-colors hover:border-signal/40"
                  >
                    {t.home.viewAll}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* KATEGORIYALAR */}
      <Section title={t.home.categoriesTitle} href="/vacancies" linkLabel={t.home.viewAll}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat, i) => (
            <CategoryCard
              key={cat.slug}
              name={names[cat.slug]}
              slug={cat.slug}
              count={categoryCounts ? categoryCounts[cat.slug] ?? 0 : null}
              index={i}
            />
          ))}
        </div>
      </Section>

      {/* SO'NGGI VAKANSIYALAR */}
      <Section title={t.home.latestTitle} href="/vacancies" linkLabel={t.home.viewAll}>
        {vacancies === null ? (
          <LoadErrorNote text={t.home.loadError} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vacancies.map((v, i) => (
              <VacancyCard
                key={v.id}
                vacancy={v}
                index={i}
                favorite={favorites.enabled ? favorites.isFavorite(v.id) : undefined}
                onToggleFavorite={favorites.enabled ? favorites.toggle : undefined}
              />
            ))}
          </div>
        )}
      </Section>

      {/* TOP KOMPANIYALAR (kartalar) */}
      <Section title={t.companies.title} href="/companies" linkLabel={t.home.viewAll}>
        {companies === null ? (
          <LoadErrorNote text={t.home.loadError} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {companies.map((c, i) => (
              <CompanyCard key={c.slug} company={c} index={i} />
            ))}
          </div>
        )}
      </Section>

      {/* ISH BERUVCHI CTA — indigo band */}
      <RevealSection className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grain relative overflow-hidden rounded-3xl bg-signal px-8 py-12 sm:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_85%_10%,rgb(236_72_153/0.35),transparent_60%)]"
          />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
                {t.home.employerCtaTitle}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/75">{t.home.employerCtaDesc}</p>
            </div>
            <a
              href={l("/employer")}
              className="shrink-0 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-signal shadow-pop transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.home.employerCtaButton}
            </a>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}

/** Scroll'da yumshoq ochiladigan bo'lim (SSR'da ko'rinadi — LCP xavfsiz). */
function RevealSection({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}

/** Editorial bo'lim sarlavhasi: matn + cho'ziluvchi chiziq + havola. */
function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  const l = useHref();
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mb-7 flex items-center gap-3 sm:gap-5">
        <h2 className="min-w-0 font-display text-xl font-bold tracking-tight text-ink sm:shrink-0 sm:text-2xl">
          {title}
        </h2>
        <span className="h-px flex-1 bg-line" aria-hidden />
        <a
          href={l(href)}
          className="group shrink-0 text-sm font-semibold text-dusk transition-colors hover:text-signal"
        >
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
            {linkLabel}
          </span>
        </a>
      </div>
      {children}
    </section>
  );
}

/** Hero statistikasi — pastel ikonka + raqam + rangli chiziqcha + izoh. */
function Stat({
  value,
  label,
  icon,
  tint,
  bar,
  divider = false,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  tint: string;
  bar: string;
  divider?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 sm:px-7 ${divider ? "sm:border-l sm:border-line" : ""}`}>
      <span style={{ background: tint }} className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-display text-[26px] font-extrabold leading-none tracking-tight text-ink">
          <CountUp value={value} />
        </div>
        <span style={{ background: bar }} className="my-1.5 block h-[3px] w-11 rounded-full" aria-hidden />
        <div className="truncate text-[13.5px] font-medium text-dusk">{label}</div>
      </div>
    </div>
  );
}

/** Blok ma'lumoti yuklanmadi — bo'sh ro'yxat emas, aniq xabar (audit ISSUE-016). */
function LoadErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-dashed border-line bg-surface px-5 py-8 text-center text-sm text-dusk">
      {text}
    </p>
  );
}
