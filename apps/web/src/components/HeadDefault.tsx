import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { THEME_INIT_SCRIPT } from "../lib/theme.js";
import { useHead } from "../lib/i18n/head.js";
import { SITE_ORIGIN, type Locale } from "../lib/i18n/config.js";

// Tiplar `Record<Locale, ...>`: yangi til qo'shilsa, TypeScript shu ikki
// jadvalni ham to'ldirishni talab qiladi — jimgina noto'g'ri qiymat ketmaydi.
const OG_LOCALE: Record<Locale, string> = { uz: "uz_UZ", ru: "ru_RU", en: "en_US" };

// Above-the-fold matndagi kritik shriftlar (public/fonts — barqaror URL'lar):
// preload bilan birinchi paint'dan OLDIN keladi, font-swap LCP'ni kechiktirmaydi.
//
// Faqat LCP matni uchun keraklisi: h1 — Plus Jakarta Sans, tavsif/tugmalar — Inter.
// Shriftlar variable bo'lgani uchun bitta fayl barcha qalinliklarni qoplaydi.
// JetBrains Mono ataylab preload QILINMAYDI — u faqat raqamlar uchun, 40 KB'ni
// LCP matni bilan poygaga qo'yishga arzimaydi (font-display: swap uni keyin qo'yadi).
const LATIN_FONTS = [
  "/fonts/inter-latin-wght-normal.woff2",
  "/fonts/plus-jakarta-sans-latin-wght-normal.woff2",
];
// Ruschada faqat Inter kirill: Plus Jakarta Sans'da bazaviy kirill subseti yo'q,
// sarlavhalar sans-serif zaxirasiga tushadi — preload qiladigan narsa yo'q.
const PRELOAD_FONTS: Record<Locale, string[]> = {
  uz: LATIN_FONTS,
  en: LATIN_FONTS,
  ru: ["/fonts/inter-cyrillic-wght-normal.woff2"],
};

// <html lang> server tomonda `+lang.ts` orqali til bo'yicha o'rnatiladi (SSR to'g'ri).

/** Barcha sahifalar uchun umumiy <head> teglari (vike-react `Head` sozlamasi). */
export default function HeadDefault() {
  const { alternates, xDefault, locale } = useHead();
  const pageContext = usePageContext();
  // Xato sahifasida (`_error`) `is404` true/false bo'ladi, oddiy sahifada — null.
  // Xato sahifasi hech qaysi tilda mavjud emas: hreflang va x-default chiqmaydi (audit R3, seo-12).
  const isErrorPage = pageContext.is404 !== null && pageContext.is404 !== undefined;
  // CSP nonce (audit R3, D-057). Dev serverda null — atribut umuman qo'yilmaydi.
  const nonce = pageContext.cspNonce ?? undefined;
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F8FE" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B0F1A" />
      {/* Kritik shriftlar (self-hosted) — font preload'ga crossOrigin majburiy */}
      {PRELOAD_FONTS[locale].map((href) => (
        <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
      ))}
      {/* Kichik ikonkalar — 512px/207KB master faylni har sahifada yuklamaslik uchun
          (o'lchamlar scripts/build-logos.mjs da chiqariladi) */}
      <link rel="icon" href="/logo-48.png" sizes="48x48" type="image/png" />
      <link rel="apple-touch-icon" href="/logo-180.png" />
      <meta property="og:site_name" content="ISH BOR!" />
      <meta property="og:locale" content={OG_LOCALE[locale]} />
      <meta property="og:image" content={`${SITE_ORIGIN}/logo.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      {/* Ko'p tilli SEO — Google har tilni alohida URL sifatida ko'radi */}
      {!isErrorPage &&
        alternates.map((a) => (
          <link key={a.locale} rel="alternate" hrefLang={a.locale} href={a.href} />
        ))}
      {!isErrorPage && <link rel="alternate" hrefLang="x-default" href={xDefault} />}
      {/* FOUC oldini olish (mavzu) — React hidratsiyasidan oldin ishlaydi */}
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
    </>
  );
}
