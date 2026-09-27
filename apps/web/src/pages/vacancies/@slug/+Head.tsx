import React from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useHead } from "../../../lib/i18n/head.js";
import { localizeHref, SITE_ORIGIN as ORIGIN } from "../../../lib/i18n/config.js";
import { API_URL } from "../../../lib/api.js";
import { JsonLd } from "../../../components/JsonLd.js";
import { Seo } from "../../../components/Seo.js";

/**
 * schema.org `employmentType`. Eski `remote` qiymati — ish JOYI, ish turi emas:
 * uni "FULL_TIME" deb ko'rsatish ma'lumotni to'qish bo'lardi (audit R3, seo-15),
 * shuning uchun u jadvalda yo'q va maydon umuman chiqarilmaydi (masofaviylik
 * `jobLocationType: TELECOMMUTE` orqali allaqachon bildiriladi).
 */
const EMPLOYMENT_SCHEMA: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  shift: "OTHER",
};

/** schema.org: talab qilinadigan tajriba (oy). "Tajribasiz" — maydon qo'yilmaydi. */
const EXPERIENCE_MONTHS: Record<string, number> = { one_to_three: 12, three_to_six: 36, six_plus: 72 };

/** Meta description: so'z o'rtasida kesilmaydi. */
function snippet(text: string, max = 155): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30))}…`;
}

export default function Head() {
  const d = useData<Awaited<ReturnType<typeof data>>>();
  const { canonical, locale, t } = useHead();
  const vacancy = d.vacancy;

  // API xatosi — sahifa indekslanmaydi (vaqtinchalik holat)
  if (!vacancy) {
    return <Seo title={t.vacancyDetail.states.errorTitle} description={t.vacancyDetail.states.errorText} noindex />;
  }

  const { company } = vacancy;
  const description = snippet(vacancy.description || vacancy.title);
  const title = `${vacancy.title} — ${company.name}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.search.breadcrumbHome, item: `${ORIGIN}${localizeHref("/", locale)}` },
      { "@type": "ListItem", position: 2, name: t.search.breadcrumbVacancies, item: `${ORIGIN}${localizeHref("/vacancies", locale)}` },
      { "@type": "ListItem", position: 3, name: vacancy.title, item: canonical },
    ],
  };

  // Faqat mavjud maydonlar — sana yoki maosh bo'lmasa to'qib qo'yilmaydi
  const jobLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: vacancy.title,
    description: vacancy.description || vacancy.title,
    ...(vacancy.publishedAt ? { datePosted: vacancy.publishedAt } : {}),
    ...(vacancy.expiresAt ? { validThrough: vacancy.expiresAt } : {}),
    ...(vacancy.employment && EMPLOYMENT_SCHEMA[vacancy.employment]
      ? { employmentType: EMPLOYMENT_SCHEMA[vacancy.employment] }
      : {}),
    // Masofaviy: schema.org TELECOMMUTE + nomzod joylashuvi talabi (O'zbekiston); hudud to'qilmaydi
    ...(vacancy.workplace === "remote"
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "UZ" } }
      : {}),
    // `directApply` ATAYLAB yo'q (audit R3, seo-15): ariza yuborish uchun saytga
    // kirish va telefon tasdig'i kerak — "bir bosishda ariza" da'vosi noto'g'ri bo'lardi.
    hiringOrganization: {
      "@type": "Organization",
      name: company.name,
      // Ichki kompaniya sahifasi — `url`; `sameAs` — faqat kompaniyaning o'z sayti (bo'lsa)
      url: `${ORIGIN}${localizeHref(`/companies/${company.slug}`, locale)}`,
      ...(company.website ? { sameAs: company.website } : {}),
      ...(company.logoUrl ? { logo: company.logoUrl } : {}),
    },
    // Masofaviy va hududsiz e'londa jismoniy manzil yo'q — `jobLocation` qo'yilmaydi
    ...(vacancy.workplace !== "remote" || vacancy.regionName || vacancy.address
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressCountry: "UZ",
              ...(vacancy.regionName ? { addressLocality: vacancy.regionName } : {}),
              ...(vacancy.address ? { streetAddress: vacancy.address } : {}),
            },
          },
        }
      : {}),
    ...(vacancy.experience && EXPERIENCE_MONTHS[vacancy.experience]
      ? { experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: EXPERIENCE_MONTHS[vacancy.experience] } }
      : {}),
    ...(vacancy.skills.length ? { skills: vacancy.skills.join(", ") } : {}),
    ...(vacancy.categoryName ? { industry: vacancy.categoryName } : {}),
    ...(vacancy.salary
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: vacancy.salary.currency,
            value: {
              "@type": "QuantitativeValue",
              ...(vacancy.salary.min ? { minValue: vacancy.salary.min } : {}),
              ...(vacancy.salary.max ? { maxValue: vacancy.salary.max } : {}),
              unitText: "MONTH",
            },
          },
        }
      : {}),
  };

  return (
    <>
      {/*
        og:image — har bir vakansiya uchun dinamik rasm (backend /api/og/vacancy/:slug).
        Manzil `VITE_API_URL` dan: tashqi botlar localhost'ni ko'rmaydi — bu kutilgan holat.
      */}
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${API_URL}/api/og/vacancy/${vacancy.slug}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <JsonLd data={jobLd} />
      <JsonLd data={breadcrumbLd} />
    </>
  );
}
