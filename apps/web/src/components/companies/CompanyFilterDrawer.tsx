import React, { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { useDialog } from "../../lib/useDialog.js";
import { clearFilters, countFilters, type CompanyQuery } from "../../lib/companies/query.js";
import { CompanyFilters } from "./CompanyFilters.js";
import { IconX } from "./icons.js";

/**
 * Mobil va planshet (< 1024px) filtrlari: telefonda pastdan chiquvchi panel,
 * planshetda o'ngdan drawer. O'zgarishlar qoralamada yig'iladi va faqat
 * "Natijalarni ko'rsatish" bosilganda qo'llanadi — har bir belgi uchun
 * ro'yxat orqada qayta yuklanib, sahifa "sakramasin".
 *
 * Fokus: ochilganda panelga o'tadi, Tab panel ichida aylanadi, Esc yopadi,
 * yopilganda fokus ochgan tugmaga qaytadi. Orqa fon aylanmaydi.
 */
export function CompanyFilterDrawer({
  open,
  value,
  canFilterSaved,
  onClose,
  onApply,
}: {
  open: boolean;
  value: CompanyQuery;
  canFilterSaved: boolean;
  onClose: () => void;
  onApply: (next: CompanyQuery) => void;
}) {
  const f = useT().companiesPage.filters;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value);
  // Ota komponent har renderda yangi funksiya bersa ham effekt qayta ishlamasin
  // (aks holda fokus va scroll qulfi har renderda "sakraydi")
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) setDraft(value);
    // faqat ochilish paytidagi holat olinadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Modal xatti-harakati (fokus tuzog'i, Esc, scroll qulfi, fokusni qaytarish) —
  // umumiy `useDialog` bilan (audit R3, a11y-ui-12: nusxa ko'chirilgan tuzoq olib tashlandi)
  useDialog(open, panelRef, onClose);

  useEffect(() => {
    if (!open) return;
    // Desktop kengligiga o'tilsa yon panel ko'rinadi — drawer keraksiz
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => desktop.matches && closeRef.current();
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, [open]);

  if (!open) return null;

  const count = countFilters(draft);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] animate-sheet-in flex-col md:animate-drawer-in rounded-t-3xl bg-surface shadow-pop md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-l-3xl md:rounded-tr-none"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-bold text-ink">
            {f.title}
            {count > 0 && <span className="ml-2 rounded-full bg-signal-soft px-2 py-0.5 text-xs font-bold text-signal">{count}</span>}
          </h2>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={f.close}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5">
          <CompanyFilters value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} canFilterSaved={canFilterSaved} />
          <div className="h-4" />
        </div>

        <div className="flex gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setDraft((d) => clearFilters(d, true))}
            disabled={count === 0}
            className="h-12 rounded-xl border border-line px-5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink"
          >
            {f.clear}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="h-12 flex-1 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
          >
            {f.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
