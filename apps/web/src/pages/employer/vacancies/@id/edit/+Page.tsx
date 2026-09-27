import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../../../components/AuthContext.js";
import { useRequireRole } from "../../../../../lib/useRoleGuard.js";
import { VacancyFormView } from "../../../../../components/employer/vacancies/VacancyFormView.js";
import { EmployerVacanciesLoading } from "../../../../../components/employer/vacancies/EmployerVacanciesView.js";

/** `/employer/vacancies/:id/edit` — vakansiyani tahrirlash (mavjud `PUT /api/vacancies/:id`). */
export default function Page() {
  const pageContext = usePageContext();
  const id = String(pageContext.routeParams?.id ?? "");
  const { status, accessToken, user } = useAuth();
  useRequireRole("employer", "/");
  if (status !== "authed" || user?.role !== "employer" || !accessToken) return <EmployerVacanciesLoading />;
  return <VacancyFormView key={id} token={accessToken} mode="edit" vacancyId={id} />;
}
