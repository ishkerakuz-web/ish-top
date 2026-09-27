import React from "react";
import { useAuth } from "../../../components/AuthContext.js";
import { useRequireRole } from "../../../lib/useRoleGuard.js";
import { EmployerVacanciesLoading, EmployerVacanciesView } from "../../../components/employer/vacancies/EmployerVacanciesView.js";

/** `/employer/vacancies` — "Vakansiyalarim" (faqat ish beruvchi; mehmon → `/login`, boshqa rol → `/`). */
export default function Page() {
  const { status, accessToken, user } = useAuth();
  useRequireRole("employer", "/");
  if (status !== "authed" || user?.role !== "employer" || !accessToken) return <EmployerVacanciesLoading />;
  return <EmployerVacanciesView token={accessToken} />;
}
