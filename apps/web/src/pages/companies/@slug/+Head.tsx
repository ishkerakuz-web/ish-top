import React from "react";
import { useData } from "vike-react/useData";
import type { data } from "./+data.js";
import { useHead } from "../../../lib/i18n/head.js";
import { localizeHref, SITE_ORIGIN as ORIGIN } from "../../../lib/i18n/config.js";
import { ratingSummary } from "../../../lib/companies/detail.js";
import { JsonLd } from "../../../components/JsonLd.js";
import { Seo } from "../../../components/Seo.js";

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
  const company = d.company;

  if (!company) {
    return <Seo title={t.companyDetail.states.errorTitle} description={t.companyDetail.states.errorText} noindex />;
  }

  const description = snippet(company.description || t.companyDetail.meta.description(company.name));
  const listed = ratingSummary(company.reviews);
  const summary =
    company.reviewTotal !== null && company.reviewTotal > company.reviews.length && company.ratingAverage !== null
      ? { ...listed, rating: company.ratingAverage, count: company.reviewTotal }
      : listed;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.search.breadcrumbHome, item: `${ORIGIN}${localizeHref("/", locale)}` },
      { "@type": "ListItem", position: 2, name: t.companies.breadcrumb, item: `${ORIGIN}${localizeHref("/companies", locale)}` },
      { "@type": "ListItem", position: 3, name: company.name, item: canonical },
    ],
  };

  // Faqat mavjud maydonlar — manzil yoki reyting bo'lmasa to'qib qo'yilmaydi
  const orgLd = {
    "@context": "https://schema.org/",
    "@type": "Organization",
    name: company.name,
    url: canonical,
    ...(company.description ? { description: company.description } : {}),
    ...(company.logoUrl ? { logo: company.logoUrl } : {}),
    ...(company.website ? { sameAs: [company.website] } : {}),
    ...(company.foundedYear ? { foundingDate: String(company.foundedYear) } : {}),
    ...(company.regionName
      ? { address: { "@type": "PostalAddress", addressLocality: company.regionName, addressCountry: "UZ" } }
      : {}),
    ...(summary.rating !== null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: summary.rating, reviewCount: summary.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return (
    <>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={`${company.name} — ISH BOR!`} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="profile" />
      <meta property="og:url" content={canonical} />
      {company.logoUrl && <meta property="og:image" content={company.logoUrl} />}
      <JsonLd data={orgLd} />
      <JsonLd data={breadcrumbLd} />
    </>
  );
}
