import { useCallback, useEffect, useState } from "react";
import { fetchCategories, fetchRegions } from "../api.js";
import { fetchSalaryStats } from "../apiExtra.js";
import type { Category, Region, SalaryStats } from "../types.js";
import { toApiParams, type SalaryQuery } from "./query.js";

/**
 * Sahifa ma'lumoti. Asosiy yo'l — `+data` (server; filtr o'zgarsa Vike qayta
 * chaqiradi, eskirgan navigatsiya chizilmaydi). Bu hook faqat server javob
 * bermagan holatni boshqaradi:
 * - brauzer bir marta o'zi qayta so'raydi, "Qayta urinish" — yana bir marta;
 * - so'rov effekt ichida: URL o'zgarsa yoki sahifa yopilsa bekor qilinadi,
 *   eski javob yangisini bosib ketmaydi (React StrictMode'dagi qayta
 *   o'rnatishda ham so'rov yo'qolib qolmaydi).
 */
export function useSalaryStats(initial: { key: string; stats: SalaryStats | null }, urlKey: string, urlQuery: SalaryQuery) {
  const [override, setOverride] = useState<{ key: string; stats: SalaryStats } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Yangi server ma'lumoti keldi — brauzerda olingani endi eskirgan
  useEffect(() => setOverride(null), [initial]);

  const needsFetch = initial.stats === null && initial.key === urlKey;

  useEffect(() => {
    if (!needsFetch) return;
    const ctrl = new AbortController();
    setRetrying(true);
    fetchSalaryStats(toApiParams(urlQuery), ctrl.signal)
      .then((stats) => {
        if (!ctrl.signal.aborted) setOverride({ key: urlKey, stats });
      })
      .catch(() => undefined) // xato holati ko'rinishda qoladi
      .finally(() => {
        if (!ctrl.signal.aborted) setRetrying(false);
      });
    return () => {
      ctrl.abort();
      setRetrying(false);
    };
  }, [needsFetch, urlKey, urlQuery, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const stats = override && override.key === urlKey ? override.stats : initial.stats;
  return { stats, retrying, retry };
}

/** Kategoriya va hududlar: serverdan (birinchi ochilish) yoki boshqa sahifadan kelganda — brauzerda. */
export function useSalaryCatalogs(initialCategories: Category[] | null, initialRegions: Region[] | null) {
  const [categories, setCategories] = useState<Category[]>(initialCategories ?? []);
  const [regions, setRegions] = useState<Region[]>(initialRegions ?? []);

  useEffect(() => {
    if (initialCategories) setCategories(initialCategories);
    if (initialRegions) setRegions(initialRegions);
  }, [initialCategories, initialRegions]);

  useEffect(() => {
    if (!initialCategories) void fetchCategories().then(setCategories);
    if (!initialRegions) void fetchRegions().then(setRegions);
    // faqat birinchi ochilishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { categories, regions };
}

export { useDelayedFlag } from "../useDelayedFlag.js";
