import React, { useEffect, useState } from "react";
import { useT, useHref, useLocale } from "../../lib/i18n/index.js";
import { formatDate } from "../../lib/format.js";
import { useAuth } from "../../components/AuthContext.js";
import { useRequireRole } from "../../lib/useRoleGuard.js";
import { ErrorState } from "../../components/profile/ui.js";
import { deleteSavedSearch, fetchSavedSearchesStrict, updateSavedSearch } from "../../lib/apiExtra.js";
import type { SavedSearch } from "../../lib/types.js";

type LoadState = "loading" | "error" | "ready";

/**
 * Saqlangan qidiruvlar (obunalar) — yangi vakansiya chiqqanda xabar keladi.
 * Audit ISSUE-022: API xatosi "obunalar yo'q" bo'lib ko'rinmaydi — xato holati va haqiqiy qayta so'rov.
 */
export default function Page() {
  const t = useT();
  const l = useHref();
  const { locale } = useLocale();
  const { status, user, accessToken } = useAuth();
  useRequireRole("job_seeker", "/employer/candidates");

  const allowed = status === "authed" && user?.role === "job_seeker" && Boolean(accessToken);
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!allowed || !accessToken) return;
    const controller = new AbortController();
    setState("loading");
    fetchSavedSearchesStrict(accessToken, controller.signal).then(
      (list) => {
        if (controller.signal.aborted) return;
        setItems(list);
        setState("ready");
      },
      (err: unknown) => {
        if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
        setState("error");
      }
    );
    return () => controller.abort();
  }, [allowed, accessToken, attempt]);

  async function toggleActive(item: SavedSearch) {
    if (!accessToken) return;
    const next = !item.emailAlertsEnabled;
    setItems((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, emailAlertsEnabled: next } : s))
    );
    await updateSavedSearch(accessToken, item.id, { emailAlertsEnabled: next }).catch(() => {
      setItems((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, emailAlertsEnabled: !next } : s))
      );
    });
  }

  async function changeFrequency(item: SavedSearch, frequency: "instant" | "daily") {
    if (!accessToken || item.frequency === frequency) return;
    const previous = item.frequency;
    setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, frequency } : s)));
    // Server rad etsa — tanlov qaytariladi (ilgari xato yutilib, ekranda saqlanmagan qiymat qolardi)
    await updateSavedSearch(accessToken, item.id, { frequency }).catch(() => {
      setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, frequency: previous } : s)));
    });
  }

  async function drop(id: string) {
    if (!accessToken) return;
    const previous = items;
    setItems((prev) => prev.filter((s) => s.id !== id));
    await deleteSavedSearch(accessToken, id).catch(() => setItems(previous));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-2 text-sm text-dusk">
        <a href={l("/")} className="hover:text-signal">
          {t.search.breadcrumbHome}
        </a>{" "}
        / {t.alerts.title}
      </div>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.alerts.title}</h1>
      <p className="mt-1 text-sm text-dusk">{t.alerts.subtitle}</p>

      <div className="mt-7">
        {state === "loading" ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-surface-2" />
            ))}
          </div>
        ) : state === "error" ? (
          <ErrorState onRetry={() => setAttempt((n) => n + 1)} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <p className="font-display text-base font-semibold text-ink">{t.alerts.empty}</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-dusk">{t.alerts.emptyHint}</p>
            <a
              href={l("/vacancies")}
              className="mt-5 inline-block rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
            >
              {t.favorites.browse}
            </a>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li
                key={item.id}
                style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }}
                className="animate-fade-up rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={l(item.url)}
                      className="font-display text-[15px] font-semibold text-ink transition-colors hover:text-signal"
                    >
                      {item.name}
                    </a>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dusk">
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-semibold ${
                          item.emailAlertsEnabled
                            ? "bg-growth/10 text-growth"
                            : "bg-surface-2 text-dusk"
                        }`}
                      >
                        {item.emailAlertsEnabled ? t.alerts.active : t.alerts.paused}
                      </span>
                      <span>
                        {t.alerts.lastChecked}:{" "}
                        {/* Audit R3, i18n-7: sana brauzer tili emas, sahifa tili bo'yicha */}
                        {item.lastNotifiedAt ? formatDate(item.lastNotifiedAt, locale) : t.alerts.never}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex overflow-hidden rounded-lg border border-line">
                      {(["instant", "daily"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={item.frequency === value}
                          onClick={() => void changeFrequency(item, value)}
                          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            item.frequency === value
                              ? "bg-signal/10 text-signal"
                              : "text-dusk hover:text-ink"
                          }`}
                        >
                          {value === "instant" ? t.alerts.instant : t.alerts.daily}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleActive(item)}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-dusk transition-colors hover:text-ink"
                    >
                      {item.emailAlertsEnabled ? t.alerts.pause : t.alerts.resume}
                    </button>
                    <button
                      type="button"
                      onClick={() => void drop(item.id)}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-dusk transition-colors hover:border-signal hover:text-signal"
                    >
                      {t.alerts.delete}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
