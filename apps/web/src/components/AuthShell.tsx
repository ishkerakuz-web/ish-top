import React, { useEffect, useState } from "react";
import { useT, useHref } from "../lib/i18n/index.js";
import { fetchStats } from "../lib/api.js";
import { formatNumber } from "../lib/format.js";
import type { Stats } from "../lib/types.js";

/**
 * Kirish va ro'yxatdan o'tish sahifalarining umumiy qobig'i.
 *
 * Chapda oq karta (forma), o'ngda brend paneli: sarlavha, uchta ustunlik va
 * ish stoli fotosi. Katta ekranda ikki ustun, telefon/planshetda faqat forma —
 * panel yashiriladi (u dekorativ, matni formadagi ma'lumotni takrorlamaydi).
 */
export function AuthShell({
  active,
  children,
}: {
  active: "login" | "signup";
  children: React.ReactNode;
}) {
  const t = useT();
  const l = useHref();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        {/* Chap ustun — forma kartasi */}
        <div className="animate-card-in flex flex-col rounded-3xl border border-line bg-surface px-5 py-5 shadow-card sm:px-9 sm:py-6">
          <a
            href={l("/")}
            className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-dusk transition-colors hover:text-signal"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              {t.login.backHome}
            </span>
          </a>

          <div className="mt-4">{children}</div>
        </div>

        {/* O'ng ustun — brend paneli (dekorativ, faqat lg+) */}
        <BrandPanel active={active} />
      </div>
    </div>
  );
}

/**
 * Auth sahifalarining o'ng paneli: va'da, uchta ustunlik, foto va raqamlar.
 * Raqamlar — bazadagi haqiqiy `/api/stats` (audit ISSUE-015: ilgari "12 000+ / 6 000+ / 300 000+"
 * qattiq yozilgan edi). So'rov bajarilmasa raqamlar bloki umuman chizilmaydi.
 */
function BrandPanel({ active }: { active: "login" | "signup" }) {
  const t = useT();
  const p = t.authPanel;
  const [stats, setStats] = useState<Stats | null>(null);

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
    <aside
      className="relative hidden overflow-hidden rounded-3xl border border-line bg-signal-soft lg:block"
      aria-hidden
    >
      {/* Foto — panelning FONI (matn uning ustiga yoziladi). Ustma-ust
          bo'lgani uchun panel matn+foto yig'indisicha cho'zilmaydi. */}
      <img
        src="/auth-desk.webp"
        alt=""
        width={920}
        height={885}
        loading={active === "login" ? "eager" : "lazy"}
        decoding="async"
        className="auth-desk pointer-events-none absolute inset-0 h-full w-full object-cover object-bottom"
      />

      {/* O'qish uchun parda: chapdan panel foniga, pastdan pastga qarab
          quyuqlashadi — matn va raqamlar fotoning ustida ham aniq o'qiladi. */}
      <span className="auth-scrim pointer-events-none absolute inset-0" />

      {/* Matn qatlami */}
      <div className="relative flex h-full flex-col justify-between px-9 py-8">
        <div>
          <p className="font-display text-[15px] font-bold tracking-tight text-ink">
            ISH BOR<span className="text-gold-deep">!</span>
          </p>
          <span className="mt-2 block h-[3px] w-11 rounded-full bg-gold" />

          <h2 className="mt-5 max-w-[19ch] font-display text-[2.05rem] font-extrabold leading-[1.14] tracking-tight text-ink">
            {p.headingLead} <span className="text-shine">{p.headingAccent}</span>
            <br />
            {p.headingTail}
          </h2>
          <p className="mt-3 max-w-[34ch] text-[14.5px] font-medium leading-relaxed text-ink/75">
            {p.subtitle}
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {p.features.map((label, i) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface/85 text-signal shadow-xs backdrop-blur-sm">
                  <FeatureIcon index={i} />
                </span>
                <span className="max-w-[16ch] text-[14.5px] font-semibold leading-tight text-ink/85">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {stats && (
          <div className="flex flex-wrap gap-x-9 gap-y-4">
            <Stat value={formatNumber(stats.vacancies)} label={p.statVacancies} bar="#3B82F6" />
            <Stat value={formatNumber(stats.companies)} label={p.statCompanies} bar="linear-gradient(90deg,#8B5CF6,#EC4899)" />
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ value, label, bar }: { value: string; label: string; bar: string }) {
  return (
    <div>
      <div className="font-display text-[22px] font-extrabold leading-none tracking-tight text-ink">
        {value}
      </div>
      <span style={{ background: bar }} className="my-1.5 block h-[3px] w-9 rounded-full" />
      <div className="text-[13px] font-semibold text-ink/75">{label}</div>
    </div>
  );
}

/** Panel ustunliklari uchun ikonkalar: qidiruv, hujjat, qo'ng'iroq. */
function FeatureIcon({ index }: { index: number }) {
  const common = {
    width: 21,
    height: 21,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (index === 0) {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8l-4.5-4.5Z" />
        <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
