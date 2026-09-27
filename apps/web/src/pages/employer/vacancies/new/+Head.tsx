import React from "react";
import { Seo } from "../../../../components/Seo.js";
import { useHead } from "../../../../lib/i18n/head.js";

export default function Head() {
  const { t } = useHead();
  return <Seo title={t.employerVacanciesPage.form.metaNew} description={t.meta.employerVacancies.description} noindex />;
}
