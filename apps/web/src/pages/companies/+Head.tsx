import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Seo } from "../../components/Seo.js";
import { useHead } from "../../lib/i18n/head.js";
import { parseCompanyQuery } from "../../lib/companies/query.js";

export default function Head() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  const query = parseCompanyQuery(search);
  // Mazmunni o'zgartiradigan tekshirilgan filtrlar kanonik manzilda qoladi,
  // qolgan variantlar `/companies` ga birlashadi (audit R3, seo-4).
  const { t, canonical } = useHead({
    industry: query.industry.length === 1 ? query.industry[0] : undefined,
    region: query.region || undefined,
  });

  // Bu `+Head` Vike merosi orqali `/companies/:slug` ga ham qo'shilardi va
  // detal sahifada ikkinchi description/og:title/canonical berardi (audit R3, seo-1).
  if (pageContext.routeParams?.slug) return null;

  return (
    <Seo
      title={t.meta.companies.title}
      description={t.meta.companies.description}
      canonical={canonical}
      // Qidiruv matni va "saqlanganlar" ro'yxati — shaxsiy/yupqa natijalar
      noindex={Boolean(query.q || query.saved)}
    />
  );
}
