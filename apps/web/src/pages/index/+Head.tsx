import React from "react";
import { Seo } from "../../components/Seo.js";
import { JsonLd } from "../../components/JsonLd.js";
import { useHead } from "../../lib/i18n/head.js";
import { SITE_ORIGIN, localizeHref } from "../../lib/i18n/config.js";

export default function Head() {
  const { t, canonical, locale } = useHead();

  // Google sitelinks qidiruv oynasi uchun
  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ISH BOR!",
    url: SITE_ORIGIN,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}${localizeHref("/vacancies", locale)}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ISH BOR!",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/logo.png`,
  };

  return (
    <>
      <Seo title={t.meta.home.title} description={t.meta.home.description} canonical={canonical} />
      <JsonLd data={websiteLd} />
      <JsonLd data={orgLd} />
    </>
  );
}
