import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchCompanyPage, type CompanyPage } from "../../lib/api.js";
import { PAGE_SIZE } from "../../lib/companies/query.js";
import type { Company } from "../../lib/types.js";
import { useT } from "../../lib/i18n/index.js";
import { CompanyCard, type CardView } from "./CompanyCard.js";
import { CompanyCardSkeleton, CompanyGridSkeleton, gridClass } from "./CompanySkeleton.js";
import { CompaniesEmptyState, CompaniesErrorState, InfiniteCompanyLoader, SavedEmptyState } from "./CompaniesStates.js";

type Status = "initial" | "idle" | "loading" | "error" | "done" | "initial-error";

/**
 * Cheksiz ro'yxat. Komponent so'rov kaliti bilan `key` qilinadi — filtr
 * o'zgarsa u butunlay yangidan tug'iladi: ro'yxat, cursor va holat boshidan.
 *
 * - Birinchi sahifa serverdan (`initial`) keladi; bo'lmasa (xato yoki
 *   `saved=1` — token faqat brauzerda) shu yerda olinadi.
 * - Keyingilari pastdagi belgi ko'rinishga yaqinlashganda (IntersectionObserver,
 *   600px oldinroq) cursor bilan so'raladi.
 * - Bir vaqtda bitta so'rov (`inFlight`); komponent almashsa so'rov bekor
 *   qilinadi — eskirgan javob yangi ro'yxatga qo'shilmaydi.
 * - Kartalar `id` bo'yicha takrorlanmaydi.
 */
export function CompanyResults({
  params,
  initial,
  token,
  needsToken,
  view,
  isSaved,
  onToggleSave,
  onTotal,
  onReset,
  savedMode,
}: {
  params: URLSearchParams;
  initial: CompanyPage | null;
  token: string | null;
  /** `true` bo'lsa token kelmaguncha so'rov yuborilmaydi. */
  needsToken: boolean;
  view: CardView;
  isSaved?: (id: string) => boolean;
  onToggleSave?: (company: Company) => void;
  onTotal: (total: number | null) => void;
  onReset: () => void;
  savedMode: boolean;
}) {
  const t = useT().companiesPage;
  const [items, setItems] = useState<Company[]>(initial?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [status, setStatus] = useState<Status>(initial ? (initial.nextCursor ? "idle" : "done") : "initial");
  const inFlight = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) onTotal(initial.total);
    return () => inFlight.current?.abort();
    // bir marta — komponent kalit bilan qayta tug'iladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(
    async (mode: "first" | "more") => {
      if (inFlight.current) return;
      if (needsToken && !token) return;
      const controller = new AbortController();
      inFlight.current = controller;
      setStatus(mode === "first" ? "initial" : "loading");
      try {
        const page = await fetchCompanyPage(params, {
          cursor: mode === "more" ? cursor : null,
          limit: PAGE_SIZE,
          signal: controller.signal,
          token,
        });
        if (controller.signal.aborted) return;
        if (mode === "first") {
          setItems(page.items);
          onTotal(page.total);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((c) => c.id));
            return [...prev, ...page.items.filter((c) => !seen.has(c.id))];
          });
        }
        setCursor(page.nextCursor);
        setStatus(page.nextCursor ? "idle" : "done");
      } catch {
        if (controller.signal.aborted) return;
        setStatus(mode === "first" ? "initial-error" : "error");
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [params, cursor, token, needsToken, onTotal]
  );

  // Serverdan birinchi sahifa kelmagan bo'lsa (token kerak yoki xato)
  useEffect(() => {
    if (!initial && status === "initial" && (!needsToken || token)) void load("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Pastga yetganda keyingi sahifa. Observer har yuklashdan keyin qayta ulanadi:
  // baland ekranda belgi hali ham ko'rinib tursa, darhol yana so'raydi.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || status !== "idle" || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void load("more");
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [status, cursor, load, items.length]);

  if (status === "initial") return <CompanyGridSkeleton count={6} view={view} />;
  if (status === "initial-error") return <CompaniesErrorState onRetry={() => void load("first")} />;
  if (items.length === 0) return savedMode ? <SavedEmptyState /> : <CompaniesEmptyState onReset={onReset} />;

  return (
    <div>
      <ul aria-label={t.states.resultsLabel} className={gridClass(view)}>
        {items.map((company) => (
          <li key={company.id} className="min-w-0">
            <CompanyCard company={company} view={view} saved={isSaved ? isSaved(company.id) : undefined} onToggleSave={onToggleSave} />
          </li>
        ))}
        {status === "loading" &&
          Array.from({ length: view === "list" ? 2 : 3 }, (_, i) => (
            <li key={`skeleton-${i}`} aria-hidden>
              <CompanyCardSkeleton view={view} />
            </li>
          ))}
      </ul>

      <div ref={sentinel} className="mt-6">
        {status === "loading" && <InfiniteCompanyLoader status="loading" onRetry={() => void load("more")} />}
        {status === "error" && <InfiniteCompanyLoader status="error" onRetry={() => void load("more")} />}
        {status === "done" && <InfiniteCompanyLoader status="done" onRetry={() => undefined} />}
      </div>
    </div>
  );
}
