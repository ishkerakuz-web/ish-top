import React from "react";
import { Seo } from "../../../components/Seo.js";
import { useHead } from "../../../lib/i18n/head.js";

export default function Head() {
  const { t } = useHead();
  return (
    <Seo
      title={t.meta.employerApplications.title}
      description={t.meta.employerApplications.description}
      noindex
    />
  );
}
