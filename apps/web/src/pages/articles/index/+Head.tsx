import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Seo } from "../../../components/Seo.js";
import { JsonLd } from "../../../components/JsonLd.js";
import { useHead } from "../../../lib/i18n/head.js";
import { SITE_ORIGIN, localizeHref } from "../../../lib/i18n/config.js";
import { parseArticlesQuery } from "../../../lib/articles/query.js";

/**
 * Kanonik manzilda kategoriya va sahifa raqami saqlanadi (audit R3, seo-4) —
 * 2-sahifa 1-sahifaga "yig'ilib" ketmasin. Qidiruv natijalari (`?q=`)
 * indekslanmaydi: yupqa, takrorlanuvchi sahifalar bo'lib qolmasin.
 */
export default function Head() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  const query = parseArticlesQuery(search);
  const { t, canonical, locale } = useHead({
    category: query.category ?? undefined,
    page: query.page > 1 ? query.page : undefined,
  });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.search.breadcrumbHome, item: `${SITE_ORIGIN}${localizeHref("/", locale)}` },
      { "@type": "ListItem", position: 2, name: t.articles.breadcrumb, item: canonical },
    ],
  };

  return (
    <>
      <Seo title={t.meta.articles.title} description={t.meta.articles.description} canonical={canonical} noindex={Boolean(query.q)} />
      <JsonLd data={breadcrumbLd} />
    </>
  );
}
