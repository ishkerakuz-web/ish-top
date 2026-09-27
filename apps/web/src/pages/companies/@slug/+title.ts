import type { PageContext } from "vike/types";
import { messagesFor } from "../../../lib/i18n/messagesFor.js";
import type { CompanyDetailData } from "../../../lib/companies/useCompanyDetail.js";

/** "[Kompaniya] — ISH BOR!"; API xatosida — xato sarlavhasi. */
export default (pageContext: PageContext) => {
  const t = messagesFor(pageContext);
  const data = pageContext.data as CompanyDetailData | undefined;
  if (!data) return t.meta.notFound.title;
  if (!data.company) return `${t.companyDetail.states.errorTitle.replace(/\.$/, "")} | ISH BOR!`;
  return `${data.company.name} — ISH BOR!`;
};
