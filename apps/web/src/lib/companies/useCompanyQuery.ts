import { useUrlQuery } from "../useUrlQuery.js";
import { parseCompanyQuery, toSearchParams } from "./query.js";

/** Katalog holati URL'da (umumiy mexanizm — lib/useUrlQuery.ts). */
export function useCompanyQuery() {
  return useUrlQuery(parseCompanyQuery, toSearchParams);
}
