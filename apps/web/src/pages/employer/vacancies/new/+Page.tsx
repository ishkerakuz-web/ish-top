import React from "react";
import { useAuth } from "../../../../components/AuthContext.js";
import { useRequireRole } from "../../../../lib/useRoleGuard.js";
import { VacancyFormView } from "../../../../components/employer/vacancies/VacancyFormView.js";
import { EmployerVacanciesLoading } from "../../../../components/employer/vacancies/EmployerVacanciesView.js";

/** `/employer/vacancies/new` — yangi vakansiya (mavjud `POST /api/vacancies`). */
export default function Page() {
  const { status, accessToken, user } = useAuth();
  useRequireRole("employer", "/");
  if (status !== "authed" || user?.role !== "employer" || !accessToken) return <EmployerVacanciesLoading />;
  return <VacancyFormView token={accessToken} mode="new" />;
}
