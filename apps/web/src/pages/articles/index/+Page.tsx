import React from "react";
import { useData } from "vike-react/useData";
import type { ArticlesPageData } from "../../../lib/articles/useArticleList.js";
import { ArticlesView } from "../../../components/articles/ArticlesView.js";

/** `/articles` — ochiq maqolalar ro'yxati (faqat chop etilganlari). */
export default function Page() {
  const initial = useData<ArticlesPageData>();
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:pt-7">
      <ArticlesView initial={initial} />
    </div>
  );
}
