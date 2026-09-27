import React from "react";

/**
 * Sahifaga xos meta teglar (og:title + description + og + canonical).
 * Brauzer <title>'i esa vike-react `+title.ts` orqali boshqariladi — SPA
 * navigatsiyada ham har sahifa o'z title'iga ega bo'lishi uchun.
 */
export function Seo({
  title,
  description,
  canonical,
  ogType = "website",
  image,
  noindex = false,
}: {
  title: string;
  description: string;
  canonical?: string;
  ogType?: "website" | "article";
  image?: string;
  noindex?: boolean;
}) {
  return (
    <>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonical && <meta property="og:url" content={canonical} />}
      {canonical && <link rel="canonical" href={canonical} />}
      {image && <meta property="og:image" content={image} />}
      {noindex && <meta name="robots" content="noindex, follow" />}
    </>
  );
}
