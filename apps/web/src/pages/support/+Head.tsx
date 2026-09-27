import React from "react";
import { Seo } from "../../components/Seo.js";
import { JsonLd } from "../../components/JsonLd.js";
import { useHead } from "../../lib/i18n/head.js";
import { buildSupportContent } from "../../lib/support/faq.js";

export default function Head() {
  const { t, canonical } = useHead();
  const { items } = buildSupportContent(t.support);

  // Google "People also ask" — savollar sahifadagi bilan bir xil, javob oddiy matn (havola belgilarisiz)
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answerText },
    })),
  };

  return (
    <>
      <Seo title={t.meta.support.title} description={t.meta.support.description} canonical={canonical} />
      {items.length > 0 && <JsonLd data={faqLd} />}
    </>
  );
}
