import React from "react";
import { useData } from "vike-react/useData";
import { useHead } from "../../../lib/i18n/head.js";
import { SITE_ORIGIN, localizeHref } from "../../../lib/i18n/config.js";
import { inlineText, parseArticleContent } from "../../../lib/articles/content.js";
import type { ArticleDetailData } from "../../../lib/articles/useArticleDetail.js";
import { JsonLd } from "../../../components/JsonLd.js";
import { Seo } from "../../../components/Seo.js";

/** Meta description: so'z o'rtasida kesilmaydi. */
function snippet(text: string, max = 155): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30))}…`;
}

/**
 * Dinamik meta: SEO sarlavha/tavsif (bo'lmasa sarlavha va qisqa tavsif, u ham
 * bo'lmasa matn boshidan), og:image — faqat muqova bo'lsa, kanonik manzil,
 * schema.org Article (faqat mavjud maydonlar).
 */
export default function Head() {
  const { article } = useData<ArticleDetailData>();
  const { t, canonical, locale } = useHead();

  if (!article) {
    return <Seo title={t.articles.detail.error.title} description={t.articles.detail.error.text} noindex />;
  }

  const firstParagraph = parseArticleContent(article.content).find((b) => b.kind === "p");
  const description = snippet(
    article.metaDescription ?? article.excerpt ?? (firstParagraph?.kind === "p" ? inlineText(firstParagraph.inlines) : article.title)
  );
  const title = `${article.metaTitle ?? article.title} — ISH BOR!`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description,
    mainEntityOfPage: canonical,
    inLanguage: locale,
    ...(article.coverUrl ? { image: [article.coverUrl] } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    ...(article.author ? { author: { "@type": "Person", name: article.author.name, ...(article.author.position ? { jobTitle: article.author.position } : {}) } } : {}),
    ...(article.hasTags ? { keywords: article.tags.join(", ") } : {}),
    publisher: { "@type": "Organization", name: "ISH BOR!", url: `${SITE_ORIGIN}${localizeHref("/", locale)}` },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.search.breadcrumbHome, item: `${SITE_ORIGIN}${localizeHref("/", locale)}` },
      { "@type": "ListItem", position: 2, name: t.articles.breadcrumb, item: `${SITE_ORIGIN}${localizeHref("/articles", locale)}` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonical },
    ],
  };

  return (
    <>
      <Seo title={title} description={description} canonical={canonical} ogType="article" image={article.coverUrl ?? undefined} />
      {article.publishedAt && <meta property="article:published_time" content={article.publishedAt} />}
      {article.updatedAt && <meta property="article:modified_time" content={article.updatedAt} />}
      {article.tags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
    </>
  );
}
