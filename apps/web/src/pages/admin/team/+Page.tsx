import React from "react";
import { AdminShell } from "../../../components/AdminShell.js";
import { TeamView } from "../../../components/admin/team/TeamView.js";

/** `/admin/team` — kontent jamoasini boshqarish (faqat SUPER_ADMIN). */
export default function Page() {
  return (
    <AdminShell>
      <TeamView />
    </AdminShell>
  );
}
