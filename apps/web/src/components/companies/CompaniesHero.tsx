import React from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import { IconArrowRight } from "./icons.js";

/**
 * Sahifa boshi: breadcrumb, sarlavha, qidiruv. Odam rasmi yoki bosh sahifa
 * vizuali takrorlanmaydi — o'ngda (lg+) faqat kichik brend banneri:
 * matn chapda, `companies-building.webp` (shaffof fonli bino kesmasi) o'ngda.
 * Matn rasmga "yopishtirilmagan": tarjima qilinadi va tungi rejimda ham o'qiladi.
 */
export function CompaniesHero({ children }: { children: React.ReactNode }) {
  const t = useT();
  const l = useHref();
  const b = t.companiesPage.banner;

  return (
    <section className="relative pt-6 sm:pt-8">
      {/* juda yengil indigo dog' — sahifa "tekis oq" bo'lib qolmasin */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[min(1100px,100%)] -translate-x-1/2 rounded-full bg-signal/[0.07] blur-3xl"
      />
      <nav aria-label="Breadcrumb" className="text-sm text-dusk">
        <ol className="flex items-center gap-1.5">
          <li>
            <a href={l("/")} className="transition-colors hover:text-signal">
              {t.search.breadcrumbHome}
            </a>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-medium text-ink">
            {t.companies.breadcrumb}
          </li>
        </ol>
      </nav>

      <div className="mt-4 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-w-0">
          <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
            {t.companies.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-dusk sm:text-base">{t.companiesPage.subtitle}</p>
          <div className="mt-6 max-w-3xl">{children}</div>
        </div>

        <a
          href={l("/vacancies")}
          className="group relative hidden h-[196px] overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-gold/[0.16] via-surface to-signal-soft shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper lg:block"
        >
          {/* osmon doiralari — bino ortidagi yumshoq havorang fon */}
          <span aria-hidden className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#BFD8FF]/55 dark:bg-signal/20" />
          <span aria-hidden className="absolute -bottom-28 right-16 h-60 w-60 rounded-full bg-[#D6E6FF]/60 dark:bg-signal/10" />

          <img
            src="/companies-building.webp"
            alt=""
            width={640}
            height={530}
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute bottom-0 right-0 h-[90%] w-auto max-w-none origin-bottom-right select-none transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          {/* matn va bino bir-biriga tegmaydi (referens kabi); parda faqat matn orqasida, binoni oqartirmaydi */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[50%] bg-gradient-to-r from-surface/90 via-surface/60 to-transparent"
          />

          <span className="relative z-10 flex h-full max-w-[52%] flex-col justify-center pl-6 xl:max-w-[60%] xl:pl-7">
            <span className="font-display text-[18px] font-extrabold leading-[1.18] tracking-tight text-ink xl:text-[21px]">
              {b.title}
            </span>
            {/* tor bannerda (1024–1279) tavsif binoga chiqib ketardi — faqat keng bannerda */}
            <span className="mt-2 hidden max-w-[270px] text-[13px] leading-snug text-ink/70 xl:block">{b.text}</span>
            <span aria-hidden className="mt-3.5 block h-1.5 w-14 rounded-full bg-gold" />
            <span className="sr-only">{b.cta}</span>
          </span>

          <span
            aria-hidden
            className="absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-pop ring-1 ring-line transition-colors group-hover:bg-signal group-hover:text-white group-hover:ring-signal"
          >
            <IconArrowRight size={20} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </a>
      </div>
    </section>
  );
}
