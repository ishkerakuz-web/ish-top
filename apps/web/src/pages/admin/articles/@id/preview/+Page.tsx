import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AdminShell } from "../../../../../components/AdminShell.js";
import { AdminArticlePreview } from "../../../../../components/admin/articles/AdminArticlePreview.js";

/** `/admin/articles/:id/preview` — saytdagi ko'rinish (qoralama ham), faqat kontent jamoasi uchun. */
export default function Page() {
  const id = String(usePageContext().routeParams?.id ?? "");
  return (
    <AdminShell allow="staff" wide>
      <AdminArticlePreview key={id} id={id} />
    </AdminShell>
  );
}
