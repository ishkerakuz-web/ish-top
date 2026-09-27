import React from "react";
import { Seo } from "../../components/Seo.js";
import { useHead } from "../../lib/i18n/head.js";

export default function Head() {
  const { t, canonical } = useHead();
  return (
    <Seo title={t.meta.profile.title} description={t.meta.profile.description} canonical={canonical} noindex />
  );
}
