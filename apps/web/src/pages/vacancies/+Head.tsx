import React from "react";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import type { data } from "./+data.js";
import { Seo } from "../../components/Seo.js";
import { JsonLd } from "../../components/JsonLd.js";
import { useHead } from "../../lib/i18n/head.js";
import { localizeHref, SITE_ORIGIN as ORIGIN } from "../../lib/i18n/config.js";
import { parseVacancyQuery } from "../../lib/vacancies/query.js";

export default function Head() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  const query = parseVacancyQuery(search);
  // Kanonik manzilda faqat MAZMUNNI o'zgartiradigan, tekshirilgan parametrlar
  // qoladi (audit R3, seo-4): sahifalash 1-sahifaga "yig'ilmasin" va filtrlangan
  // ro'yxatning 2-sahifasi filtrsiz 2-sahifaga ishora qilmasin. Saralash,
  // o'lcham, maosh oralig'i kabi variantlar esa asosiy manzilga birlashadi.
  const { t, canonical, locale } = useHead({
    category: query.category || undefined,
    region: query.region.length === 1 ? query.region[0] : undefined,
    page: query.page > 1 ? query.page : undefined,
  });
  const d = useData<Awaited<ReturnType<typeof data>>>();

  // Vike `+Head` ni pastdagi marshrutlarga meros qiladi: bu fayl `/vacancies/:slug`
  // sahifasiga ham qo'shilib, ikkinchi description/og:title/canonical berardi
  // (audit R3, seo-1). Detal sahifada `routeParams.slug` bor — hech narsa chizmaymiz.
  if (pageContext.routeParams?.slug) return null;

  const q = query.q;
  const meta = q ? t.meta.searchQuery(q) : t.meta.searchAll;
  const items = d?.page?.items ?? [];

  // SSR'dagi joriy sahifa — Google natijalar sonini va tuzilmani ko'radi
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: d?.page?.total ?? 0,
    itemListElement: items.slice(0, 10).map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.title,
      url: `${ORIGIN}${localizeHref(`/vacancies/${v.slug}`, locale)}`,
    })),
  };

  return (
    <>
      {/* Foydalanuvchi yozgan qidiruv matni bilan sahifa indekslanmaydi — yupqa,
          cheksiz ko'p va tashqaridan boshqariladigan sarlavhalar bo'lib qolmasin. */}
      <Seo title={meta.title} description={meta.description} canonical={canonical} noindex={Boolean(q)} />
      {items.length > 0 && <JsonLd data={listLd} />}
    </>
  );
}
