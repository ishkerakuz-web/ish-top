import type { PageContext } from "vike/types";
import { messagesFor } from "../../../lib/i18n/messagesFor.js";
import type { VacancyDetailData } from "../../../lib/vacancies/useVacancyDetail.js";

/** "[Vakansiya] — [Kompaniya] | ISH BOR!"; API xatosida — xato sarlavhasi. */
export default (pageContext: PageContext) => {
  const t = messagesFor(pageContext);
  const data = pageContext.data as VacancyDetailData | undefined;
  if (!data) return t.meta.notFound.title;
  if (!data.vacancy) return `${t.vacancyDetail.states.errorTitle.replace(/\.$/, "")} | ISH BOR!`;
  return `${data.vacancy.title} — ${data.vacancy.company.name} | ISH BOR!`;
};
