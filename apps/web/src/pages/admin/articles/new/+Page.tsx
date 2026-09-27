import React from "react";
import { AdminShell } from "../../../../components/AdminShell.js";
import { AdminArticleEditor } from "../../../../components/admin/articles/AdminArticleEditor.js";

/** `/admin/articles/new` — yangi maqola (avval qoralama sifatida saqlanadi). */
export default function Page() {
  return (
    <AdminShell allow="staff" wide>
      <AdminArticleEditor articleId={null} />
    </AdminShell>
  );
}
