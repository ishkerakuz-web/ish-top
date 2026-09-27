import { useCallback, useEffect, useRef, useState } from "react";

export type AdminResourceState<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: T };

/** Ichki holat — javob qaysi `key` uchun kelgani bilan (audit PHASE 6, U28). */
type KeyedState<T> = { kind: "loading" } | { kind: "error"; key: string } | { kind: "ready"; data: T; key: string };

const LOADING: { kind: "loading" } = { kind: "loading" };

/**
 * Admin sahifalari uchun yuklash holati (audit ISSUE-021):
 * - API xatosi bo'sh jadval bo'lib ko'rinmaydi (`error` + haqiqiy qayta so'rov);
 * - filtr yoki sahifa tez o'zgarsa eski javob yangisini yozmaydi (AbortController);
 * - xuddi shu so'rov yangilanayotganda (amaldan keyingi `reload`) oldingi jadval ko'rinib turadi, `pending` bilan;
 * - `key` o'zgarsa (boshqa filtr yoki sahifa) yangi javob kelguncha `loading`: eski filtrning qatorlari,
 *   sahifalagichi va "bo'sh" matni ko'rinib, bosishlar noto'g'ri ma'lumotga tushmaydi (audit PHASE 6, U28).
 *
 * `loader` null bo'lsa (hali admin ekanligi tasdiqlanmagan) so'rov yuborilmaydi. `key` — so'rov
 * parametrlari (o'zgarsa qayta yuklanadi).
 */
export function useAdminResource<T>(loader: ((signal: AbortSignal) => Promise<T>) | null, key: string) {
  const [inner, setInner] = useState<KeyedState<T>>(LOADING);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const enabled = loader !== null;

  useEffect(() => {
    const run = loaderRef.current;
    if (!run) return;
    const controller = new AbortController();
    setPending(true);
    // Faqat shu kalitning tayyor ma'lumoti saqlanadi (reload); boshqa kalit — skelet (audit PHASE 6, U28)
    setInner((prev) => (prev.kind === "ready" && prev.key === key ? prev : LOADING));
    run(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setInner({ kind: "ready", data, key });
        setPending(false);
      },
      (err: unknown) => {
        if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
        setInner({ kind: "error", key });
        setPending(false);
      }
    );
    return () => controller.abort();
  }, [enabled, key, attempt]);

  // Kalit o'zgargan render'dayoq (effekt ishlashidan oldin) eski kalitning jadvali yoki xatosi chiqmasin
  const state: AdminResourceState<T> = inner.kind !== "loading" && inner.key !== key ? LOADING : inner;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, pending, reload };
}
