import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useT, useHref, useLocale } from "../lib/i18n/index.js";
import { LOCALES, LOCALE_SHORT, localizeHref } from "../lib/i18n/config.js";
import { pageLocale } from "../lib/i18n/pageLocale.js";

/** Mahsulot (dashboard) sahifalari — katta editorial footer o'rniga ixcham qator. */
const COMPACT_PREFIXES = ["/profile", "/applications", "/favorites", "/notifications", "/messages", "/admin", "/employer/applications"];
/** Listing va yordam sahifalari — ustunli, lekin yirik so'z-belgisiz va zich footer. */
const PRODUCT_PATHS = ["/vacancies", "/companies", "/salaries", "/articles", "/support", "/contact"];

export default function Footer() {
  const t = useT();
  const pageContext = usePageContext();
  const pathname = pageLocale(pageContext).pathname;
  const search = pageContext.urlParsed?.searchOriginal ?? "";
  if (COMPACT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return <CompactFooter pathname={pathname} search={search} />;
  }
  // Vakansiya, kompaniya va maqola detail sahifalari ham ro'yxat bilan bir xil zich footer oladi
  // Ish beruvchi paneli (`/employer/...`) ham — yirik so'z-belgisiz. Tariflar havolasi yo'q (platforma hozircha bepul).
  const employerPanel = pathname.startsWith("/employer/");
  const product =
    PRODUCT_PATHS.includes(pathname) ||
    pathname.startsWith("/vacancies/") ||
    pathname.startsWith("/companies/") ||
    pathname.startsWith("/articles/") ||
    employerPanel;
  return (
    <footer className="border-t border-line">
      {/* Yirik so'z-belgi qatori — editorial imzo (listing sahifalarida yo'q) */}
      {!product && (
        <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
          <p
            aria-hidden
            className="select-none font-display text-[17vw] font-bold leading-[0.85] tracking-tight text-ink/[0.06] sm:text-[8.5rem] lg:text-[11rem]"
          >
            ISH BOR<span className="text-gold/40">!</span>
          </p>
        </div>
      )}

      <div
        className={`mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-5 ${
          product ? "gap-y-8 py-10" : "border-t border-line py-12"
        }`}
      >
        <div className="md:col-span-2">
          <p className="font-display text-base font-bold text-ink">
            ISH BOR<span className="text-gold" aria-hidden>!</span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dusk">{t.footer.tagline}</p>
        </div>

        <FooterColumn
          title={t.footer.seekersTitle}
          links={[
            { label: t.footer.seekersVacancies, href: "/vacancies" },
            { label: t.footer.seekersResume, href: "/profile" },
            { label: t.footer.seekersSalary, href: "/salaries" },
            { label: t.footer.seekersArticles, href: "/articles" },
          ]}
        />
        <FooterColumn
          title={t.footer.employersTitle}
          links={[
            { label: t.footer.employersPost, href: "/employer" },
            { label: t.footer.employersBase, href: "/employer" },
          ]}
        />
        <FooterColumn
          title={t.footer.companyTitle}
          links={[
            { label: t.footer.companyCompanies, href: "/companies" },
            { label: t.footer.companyContact, href: "/contact" },
            { label: t.footer.companySupport, href: "/support" },
          ]}
        />
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 text-xs text-dusk sm:px-6">
          <span>{t.footer.rights(new Date().getFullYear())}</span>
          {product ? (
            <LocaleLinks pathname={pathname} search={search} />
          ) : (
            <span className="font-mono tabular-nums" aria-hidden>
              UZ · RU · EN
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  const l = useHref();
  return (
    <div>
      {/* Sarlavha emas (h1→h4 sakramasin) — vizual uslub saqlangan */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dusk">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm text-ink/80">
        {links.map((link) => (
          <li key={link.label}>
            <a href={l(link.href)} className="transition-colors hover:text-ink hover:underline underline-offset-4">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompactFooter({ pathname, search }: { pathname: string; search: string }) {
  const t = useT();
  const l = useHref();
  const links = [
    { label: t.footer.seekersTitle, href: "/vacancies" },
    { label: t.footer.employersTitle, href: "/employer" },
    { label: t.footer.companyCompanies, href: "/companies" },
    { label: t.profileHub.footer.help, href: "/support" },
    { label: t.footer.companyContact, href: "/contact" },
  ];

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
          <a href={l("/")} className="whitespace-nowrap font-display text-[15px] font-bold text-ink">
            ISH BOR<span className="text-gold" aria-hidden>!</span>
          </a>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-dusk">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={l(link.href)} className="transition-colors hover:text-ink">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-dusk">
          <LocaleLinks pathname={pathname} search={search} />
          <span>{t.footer.rights(new Date().getFullYear())}</span>
        </div>
      </div>
    </footer>
  );
}

/** Joriy sahifaning boshqa tillardagi manzillari (so'rov parametrlari saqlanadi). */
function LocaleLinks({ pathname, search }: { pathname: string; search: string }) {
  const { locale } = useLocale();
  return (
    <ul className="flex items-center gap-1 font-mono text-xs text-dusk">
      {LOCALES.map((loc) => (
        <li key={loc}>
          <a
            href={localizeHref(pathname, loc) + search}
            hrefLang={loc}
            aria-current={loc === locale ? "true" : undefined}
            className={`rounded-md px-1.5 py-1 transition-colors ${
              loc === locale ? "bg-surface-2 font-semibold text-ink" : "hover:text-ink"
            }`}
          >
            {LOCALE_SHORT[loc]}
          </a>
        </li>
      ))}
    </ul>
  );
}
