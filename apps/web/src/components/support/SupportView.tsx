import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { SupportCategoryKey } from "../../lib/i18n/types.js";
import { useHistoryQuery } from "../../lib/useHistoryQuery.js";
import { buildSupportContent, filterSupportItems, supportSuggestions } from "../../lib/support/faq.js";
import { parseSupportQuery, supportSearch } from "../../lib/support/query.js";
import { useArticleMatches } from "../../lib/support/hooks.js";
import { SupportHeader } from "./SupportHeader.js";
import { SupportSearch } from "./SupportSearch.js";
import { SupportSearchSuggestions } from "./SupportSearchSuggestions.js";
import { SupportCategories } from "./SupportCategories.js";
import { SupportFaq } from "./SupportFaq.js";
import { SupportArticleResults } from "./SupportArticleResults.js";
import { SupportEmptyState, SupportNoFaqState } from "./SupportEmptyState.js";
import { SupportContactCta } from "./SupportContactCta.js";

/**
 * `/support` — foydalanuvchi muammoni o'zi hal qilishi uchun: qidiruv → tezkor
 * so'zlar → kategoriyalar → savollar → (kerak bo'lsa) jamoaga yozish.
 * Holat URL'da (`?q=`, `?category=`): refresh va orqaga/oldinga saqlanadi.
 */
export function SupportView() {
  const s = useT().support;
  const content = useMemo(() => buildSupportContent(s), [s]);
  const { query, queryRef, commit } = useHistoryQuery(parseSupportQuery, supportSearch);

  // URL'dagi kategoriyada savol bo'lmasa — filtr yo'q deb olinadi
  const activeCategory = content.categories.find((category) => category.key === query.category) ?? null;
  const categoryKey = activeCategory?.key ?? null;
  const results = useMemo(() => filterSupportItems(content.items, query.q, categoryKey), [content.items, query.q, categoryKey]);
  const suggestions = useMemo(() => supportSuggestions(s.suggestions, content.items), [s.suggestions, content.items]);
  const { state: articles, retry } = useArticleMatches(query.q);

  // Bitta javob ochiq: boshida birinchisi, qidiruv/filtr o'zgarsa — birinchi natija
  const [openId, setOpenId] = useState<string | null>(() => results[0]?.id ?? null);
  const filterKey = `${query.q}|${categoryKey ?? ""}`;
  const shownKey = useRef(filterKey);
  useEffect(() => {
    if (shownKey.current === filterKey) return;
    shownKey.current = filterKey;
    setOpenId(results[0]?.id ?? null);
  }, [filterKey, results]);

  const setQ = useCallback((q: string) => commit({ ...queryRef.current, q }, true), [commit, queryRef]);
  const setCategory = useCallback((category: SupportCategoryKey | null) => commit({ ...queryRef.current, category }), [commit, queryRef]);
  const clearAll = useCallback(() => commit({ q: "", category: null }), [commit]);

  // `/support#faq-password` — shu savol ochiladi (filtr uni yashirsa, filtr olib tashlanadi)
  useEffect(() => {
    const openFromHash = () => {
      const match = window.location.hash.match(/^#faq-([a-z0-9-]+)$/i);
      const item = match ? content.items.find((i) => i.id === match[1].toLowerCase()) : undefined;
      if (!item) return;
      const { q, category } = queryRef.current;
      if (q || category) {
        shownKey.current = "|";
        commit({ q: "", category: null }, true);
      }
      setOpenId(item.id);
      window.requestAnimationFrame(() => document.getElementById(`faq-${item.id}-button`)?.scrollIntoView({ block: "center" }));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [content.items, commit, queryRef]);

  const searching = query.q !== "" || categoryKey !== null;
  const articlesFound = articles.status === "ready" && articles.items.length > 0;
  const showEmpty = content.items.length > 0 && results.length === 0 && articles.status !== "loading" && !articlesFound;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6 lg:pt-7">
      <SupportHeader>
        <SupportSearch value={query.q} onSearch={setQ} />
        <SupportSearchSuggestions terms={suggestions} active={query.q} onPick={setQ} />
      </SupportHeader>

      <p role="status" className="sr-only">
        {searching ? s.results(results.length) : ""}
      </p>

      {content.items.length === 0 ? (
        <SupportNoFaqState />
      ) : (
        <>
          <SupportCategories categories={content.categories} active={categoryKey} onSelect={setCategory} />
          <SupportFaq
            items={results}
            title={activeCategory ? s.faqInCategory(activeCategory.title) : s.faqTitle}
            resultsLabel={searching ? s.results(results.length) : null}
            openId={openId}
            onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
          />
        </>
      )}

      <SupportArticleResults q={query.q} state={articles} onRetry={retry} />
      {showEmpty && <SupportEmptyState onClear={clearAll} />}
      <SupportContactCta />
    </div>
  );
}
