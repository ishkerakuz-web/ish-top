import type { PageContext } from "vike/types";
import { messagesFor } from "../../../lib/i18n/messagesFor.js";
import type { ArticleDetailData } from "../../../lib/articles/useArticleDetail.js";

/** "[SEO sarlavha yoki sarlavha] — ISH BOR!"; API xatosida — xato sarlavhasi. */
export default (pageContext: PageContext) => {
  const t = messagesFor(pageContext);
  const data = pageContext.data as ArticleDetailData | undefined;
  if (!data) return t.meta.notFound.title;
  if (!data.article) return `${t.articles.detail.error.title.replace(/\.$/, "")} | ISH BOR!`;
  return `${data.article.metaTitle ?? data.article.title} — ISH BOR!`;
};
