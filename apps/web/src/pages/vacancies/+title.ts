import type { PageContext } from "vike/types";
import { messagesFor } from "../../lib/i18n/messagesFor.js";
import { parseVacancyQuery } from "../../lib/vacancies/query.js";

export default (pageContext: PageContext) => {
  const { q } = parseVacancyQuery(pageContext.urlParsed.search);
  const meta = messagesFor(pageContext).meta;
  return q ? meta.searchQuery(q).title : meta.searchAll.title;
};
