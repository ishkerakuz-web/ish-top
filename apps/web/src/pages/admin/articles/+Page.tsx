import React from "react";
import { AdminShell } from "../../../components/AdminShell.js";
import { AdminArticleList } from "../../../components/admin/articles/AdminArticleList.js";

/** `/admin/articles` — SUPER_ADMIN, muharrir va muallif (muallif — faqat o'z maqolalari). */
export default function Page() {
  return (
    <AdminShell allow="staff" wide>
      <AdminArticleList />
    </AdminShell>
  );
}
