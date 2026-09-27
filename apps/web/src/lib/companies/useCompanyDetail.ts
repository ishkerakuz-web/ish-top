import { useCallback, useEffect, useState } from "react";
import { fetchCompanyDetail, fetchSimilarCompanies } from "../api.js";
import type { Company } from "../types.js";
import type { CompanyDetailVM } from "./detail.js";

/** `+data` natijasi: `company === null` — API xatosi (404 serverda `render(404)` bilan). */
export interface CompanyDetailData {
  slug: string;
  company: CompanyDetailVM | null;
  similar: Company[];
}

export type CompanyDetailState =
  | { kind: "ok"; company: CompanyDetailVM; similar: Company[] }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not_found" };

export const SIMILAR_COMPANIES_LIMIT = 5;

/**
 * Server ma'lumotini oladi; server "yuklab bo'lmadi" desa brauzer bir marta
 * jimgina qayta so'raydi, "Qayta urinish" esa skelet bilan qayta yuklaydi.
 * Komponent har slug uchun `key` bilan qayta tug'iladi (vakansiya sahifasidagi naqsh).
 */
export function useCompanyDetail(initial: CompanyDetailData) {
  const { slug } = initial;
  const [state, setState] = useState<CompanyDetailState>(() =>
    initial.company ? { kind: "ok", company: initial.company, similar: initial.similar } : { kind: "error" }
  );
  const [request, setRequest] = useState(() => ({ id: initial.company ? 0 : 1, silent: true }));
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (request.id === 0) return;
    const controller = new AbortController();
    if (request.silent) setRetrying(true);
    else setState({ kind: "loading" });

    Promise.all([fetchCompanyDetail(slug, controller.signal), fetchSimilarCompanies(slug, SIMILAR_COMPANIES_LIMIT, controller.signal)])
      .then(([company, similar]) => setState(company ? { kind: "ok", company, similar } : { kind: "not_found" }))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ kind: "error" });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRetrying(false);
      });

    return () => controller.abort();
  }, [request, slug]);

  const retry = useCallback(() => setRequest((r) => ({ id: r.id + 1, silent: false })), []);
  return { state, retry, retrying };
}
