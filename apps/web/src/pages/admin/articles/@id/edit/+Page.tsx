import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AdminShell } from "../../../../../components/AdminShell.js";
import { AdminArticleEditor } from "../../../../../components/admin/articles/AdminArticleEditor.js";

/** `/admin/articles/:id/edit` — tahrirlash (ruxsat serverda: muallif faqat o'z qoralamasini). */
export default function Page() {
  const id = String(usePageContext().routeParams?.id ?? "");
  return (
    <AdminShell allow="staff" wide>
      <AdminArticleEditor key={id} articleId={id} />
    </AdminShell>
  );
}
