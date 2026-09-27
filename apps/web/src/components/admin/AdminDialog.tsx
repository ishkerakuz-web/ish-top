import React, { useEffect, useId, useRef, useState } from "react";
import { useDialog } from "../../lib/useDialog.js";
import { useT } from "../../lib/i18n/index.js";
import { ADMIN_INPUT, ADMIN_PRIMARY, ADMIN_SECONDARY } from "./AdminStates.js";

/**
 * Admin panelning umumiy modal oynasi (fokus tuzog'i, Esc, orqa fon) — `side="right"` bo'lsa
 * o'ng tomondan chiquvchi panel (vakansiyani to'liq ko'rish uchun).
 */
export function AdminDialog({
  open,
  onClose,
  title,
  children,
  footer,
  side = "center",
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "center" | "right";
  closeLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(open, panelRef, onClose);
  if (!open) return null;

  const panelClass =
    side === "right"
      ? "relative ml-auto flex h-full w-full max-w-2xl flex-col bg-surface shadow-pop outline-none"
      : "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop outline-none sm:max-w-lg sm:rounded-3xl";

  return (
    <div className={`fixed inset-0 z-[60] flex ${side === "right" ? "" : "items-end justify-center sm:items-center sm:p-4"}`}>
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={panelClass}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="min-w-0 font-display text-lg font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-dusk transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Sabab so'rovchi oyna (rad etish, kompaniya so'rovini rad etish). Tayyor sabablar bir bosishda
 * matnga qo'shiladi va tahrirlanadi — `window.prompt` o'rniga (admin-staff-12 ogohlantirishi saqlanadi).
 */
export function ReasonDialog({
  open,
  title,
  subject,
  templates = [],
  placeholder,
  submitLabel,
  required = true,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  /** Qaysi yozuv ekani (e'lon nomi, kompaniya) — xato bosishni kamaytiradi. */
  subject?: string;
  templates?: string[];
  placeholder: string;
  submitLabel: string;
  required?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const r = useT().admin.reject;
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const fieldId = useId();

  useEffect(() => {
    if (open) {
      setText("");
      setError(false);
    }
  }, [open]);

  const addTemplate = (tpl: string) => setText((prev) => (prev.trim() ? `${prev.trim()}\n${tpl}` : tpl));

  const submit = () => {
    const value = text.trim();
    if (required && !value) {
      setError(true);
      return;
    }
    onSubmit(value);
  };

  return (
    <AdminDialog
      open={open}
      onClose={onCancel}
      title={title}
      closeLabel={r.cancel}
      footer={
        <>
          <button type="button" className={ADMIN_SECONDARY} onClick={onCancel}>
            {r.cancel}
          </button>
          <button type="button" className={ADMIN_PRIMARY} onClick={submit}>
            {submitLabel}
          </button>
        </>
      }
    >
      {subject && <p className="mb-3 text-sm font-semibold text-ink">{subject}</p>}
      {templates.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-dusk">{r.templatesLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => addTemplate(tpl)}
                className="rounded-lg border border-line px-2.5 py-1 text-left text-xs text-dusk transition-colors hover:border-signal/40 hover:text-ink"
              >
                {tpl}
              </button>
            ))}
          </div>
        </div>
      )}
      <label htmlFor={fieldId} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(false);
        }}
        rows={4}
        maxLength={500}
        placeholder={placeholder}
        aria-invalid={error || undefined}
        className={`${ADMIN_INPUT} resize-none`}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {r.required}
        </p>
      )}
    </AdminDialog>
  );
}

/** Tanlangan qatorlar uchun ommaviy amallar paneli. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const b = useT().admin.bulk;
  if (count === 0) return null;
  return (
    <div className="sticky top-20 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-signal/30 bg-surface px-4 py-2.5 shadow-card" role="region" aria-label={b.selected(count)}>
      <span className="text-sm font-semibold text-ink">{b.selected(count)}</span>
      <div className="ml-auto flex flex-wrap gap-1.5">
        {children}
        <button type="button" onClick={onClear} className="rounded-lg px-2.5 py-1 text-xs font-medium text-dusk hover:text-ink">
          {b.clear}
        </button>
      </div>
    </div>
  );
}

/** Tanlash katakchasi (sahifadagi qator yoki "hammasi"). */
export function SelectBox({ checked, onChange, label, indeterminate = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-line accent-signal"
    />
  );
}

/** Sahifadagi qatorlarni tanlash holati; sahifa/filtr o'zgarsa tanlov tozalanadi. */
export function useSelection(resetKey: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [resetKey]);
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setAll = (ids: string[], on: boolean) => setSelected(on ? new Set(ids) : new Set());
  const clear = () => setSelected(new Set());
  return { selected, toggle, setAll, clear };
}
