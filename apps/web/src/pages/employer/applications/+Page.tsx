import React from "react";
import { useAuth } from "../../../components/AuthContext.js";
import { useRequireRole } from "../../../lib/useRoleGuard.js";
import { EmployerApplicationsLoading, EmployerApplicationsView } from "../../../components/employer/applications/EmployerApplicationsView.js";

/** `/employer/applications` — "Murojaatlar" (faqat ish beruvchi; mehmon → `/login`, boshqa rol → `/`). */
export default function Page() {
  const { status, accessToken, user } = useAuth();
  useRequireRole("employer", "/");
  if (status !== "authed" || user?.role !== "employer" || !accessToken) return <EmployerApplicationsLoading />;
  return <EmployerApplicationsView token={accessToken} />;
}
