import { useCallback, useEffect, useState } from "react";
import { fetchSimilarVacancies, fetchVacancyDetail } from "../api.js";
import { reportVacancyView } from "../views.js";
import type { Vacancy } from "../types.js";
import type { VacancyDetailVM } from "./detail.js";

/** `+data` natijasi: `vacancy === null` — API xatosi (404 serverda `render(404)` bilan). */
export interface VacancyDetailData {
  slug: string;
  vacancy: VacancyDetailVM | null;
  similar: Vacancy[];
}

export type VacancyDetailState =
  | { kind: "ok"; vacancy: VacancyDetailVM; similar: Vacancy[] }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not_found" };

export const SIMILAR_LIMIT = 4;

/**
 * Server ma'lumotini oladi; server "yuklab bo'lmadi" desa brauzer bir marta
 * o'zi jimgina qayta so'raydi (tugmada spinner), "Qayta urinish" esa skelet
 * bilan qayta yuklaydi. Komponent har slug uchun `key` bilan qayta tug'iladi.
 */
export function useVacancyDetail(initial: VacancyDetailData) {
  const { slug } = initial;
  const [state, setState] = useState<VacancyDetailState>(() =>
    initial.vacancy ? { kind: "ok", vacancy: initial.vacancy, similar: initial.similar } : { kind: "error" }
  );
  const [request, setRequest] = useState(() => ({ id: initial.vacancy ? 0 : 1, silent: true }));
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (request.id === 0) return;
    const controller = new AbortController();
    if (request.silent) setRetrying(true);
    else setState({ kind: "loading" });

    Promise.all([fetchVacancyDetail(slug, controller.signal), fetchSimilarVacancies(slug, SIMILAR_LIMIT, controller.signal)])
      .then(([vacancy, similar]) => setState(vacancy ? { kind: "ok", vacancy, similar } : { kind: "not_found" }))
      .catch((err: unknown) => {
        if ((err as Error)?.name !== "AbortError") setState({ kind: "error" });
      })
      .finally(() => {
        if (!controller.signal.aborted) setRetrying(false);
      });

    return () => controller.abort();
  }, [request, slug]);

  // Ko'rish faqat sahifa HAQIQATAN ochilganda va faqat brauzerdan sanaladi (audit: views-1)
  useEffect(() => {
    if (state.kind === "ok") reportVacancyView(slug);
  }, [slug, state.kind]);

  const retry = useCallback(() => setRequest((r) => ({ id: r.id + 1, silent: false })), []);
  return { state, retry, retrying };
}
