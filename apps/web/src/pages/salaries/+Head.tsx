import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Seo } from "../../components/Seo.js";
import { useHead } from "../../lib/i18n/head.js";
import { parseSalaryQuery } from "../../lib/salaries/query.js";

// Maosh statistikasi — ochiq va indekslanadigan sahifa (SEO uchun qimmatli).
export default function Head() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  const query = parseSalaryQuery(search);
  // Sitemap `/salaries?category=<slug>` va `/salaries?region=<slug>` manzillarini
  // e'lon qiladi — kanonik manzil ular bilan MOS kelishi shart, aks holda bu
  // sahifalar "canonical boshqa sahifada" deb tashlab yuborilardi (audit R3, seo-4).
  // Kasb (`role`) sahifasi ham o'ziga kanonik; erkin matn (`q`) esa indekslanmaydi.
  const { t, canonical } = useHead({
    role: query.role || undefined,
    category: query.category || undefined,
    region: query.region || undefined,
  });
  return (
    <Seo
      title={t.metaExtra.salaries.title}
      description={t.metaExtra.salaries.description}
      canonical={canonical}
      noindex={Boolean(query.q)}
    />
  );
}
