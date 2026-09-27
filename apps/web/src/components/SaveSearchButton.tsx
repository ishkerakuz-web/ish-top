import React, { useId, useRef, useState } from "react";
import { useT, useHref } from "../lib/i18n/index.js";
import { useAuth } from "./AuthContext.js";
import { useClickOutside } from "../lib/useClickOutside.js";
import { createSavedSearch } from "../lib/apiExtra.js";
import type { SavedSearchParams } from "../lib/types.js";

const DEFAULT_BUTTON =
  "flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-signal hover:text-signal";

/**
 * Joriy qidiruv filtrlarini obuna sifatida saqlaydi.
 * Mehmon bosgan bo'lsa — login sahifasiga yo'naltiradi.
 */
export function SaveSearchButton({
  params,
  defaultName,
  label,
  icon = "bell",
  buttonClassName = DEFAULT_BUTTON,
  popoverClassName = "right-0",
}: {
  params: SavedSearchParams;
  /** Forma ochilganda taklif qilinadigan nom (odatda qidiruv matni). */
  defaultName: string;
  /** Tugma matni (standart — "Obuna bo'lish"). */
  label?: string;
  icon?: "bell" | "heart";
  buttonClassName?: string;
  /** Oyna joylashuvi: tugma ekranning chap chetida bo'lsa `left-0`. */
  popoverClassName?: string;
}) {
  const t = useT();
  const l = useHref();
  const nameId = useId();
  const { status, user, accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [frequency, setFrequency] = useState<"instant" | "daily">("daily");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useClickOutside(boxRef, () => setOpen(false), open);

  const isSeeker = status === "authed" && user?.role === "job_seeker";

  if (status === "authed" && !isSeeker) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await createSavedSearch(accessToken, {
        name: name.trim() || defaultName || t.alerts.title,
        queryParams: params,
        frequency,
      });
      setDone(true);
      window.setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.common.failed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-expanded={isSeeker ? open : undefined}
        onClick={() => {
          if (!isSeeker) {
            window.location.assign(l("/login"));
            return;
          }
          setName(defaultName);
          setOpen((v) => !v);
        }}
        className={buttonClassName}
      >
        {icon === "heart" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 20s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.5 2.8C19.5 15.6 12 20 12 20z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M18 8.5a6 6 0 10-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M13.7 19a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )}
        {label ?? t.alerts.saveCurrent}
      </button>

      {open && (
        <div
          className={`absolute ${popoverClassName} z-40 mt-2 w-[300px] max-w-[calc(100vw-2rem)] origin-top-right animate-pop rounded-xl border border-line bg-surface p-4 text-left shadow-pop`}
        >
          {done ? (
            <p className="py-3 text-center text-sm font-medium text-growth">{t.alerts.created}</p>
          ) : (
            <form onSubmit={submit}>
              <p className="font-display text-sm font-bold text-ink">{t.alerts.dialogTitle}</p>

              <label className="mt-3 block text-xs font-medium text-dusk" htmlFor={nameId}>
                {t.alerts.nameLabel}
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.alerts.namePlaceholder}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-dusk focus:border-signal focus:bg-surface focus:outline-none"
              />

              <span className="mt-3 block text-xs font-medium text-dusk">
                {t.alerts.frequencyLabel}
              </span>
              <div className="mt-1.5 flex gap-2">
                {(["instant", "daily"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={frequency === value}
                    onClick={() => setFrequency(value)}
                    className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      frequency === value
                        ? "border-signal bg-signal/10 text-signal"
                        : "border-line text-dusk hover:text-ink"
                    }`}
                  >
                    {value === "instant" ? t.alerts.instant : t.alerts.daily}
                  </button>
                ))}
              </div>

              {error && (
                <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                  {error}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-signal py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
                >
                  {t.alerts.create}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-dusk transition-colors hover:text-ink"
                >
                  {t.alerts.cancel}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
