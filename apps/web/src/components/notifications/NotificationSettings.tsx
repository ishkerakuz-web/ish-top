import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchNotificationPrefs, saveNotificationPrefs } from "../../lib/apiExtra.js";
import { NOTIFICATION_TYPES } from "../../lib/notifications/adapter.js";
import { useT } from "../../lib/i18n/index.js";
import type { NotificationChannel, NotificationPref, NotificationType } from "../../lib/types.js";
import { usePush } from "../../lib/usePush.js";
import { Skeleton } from "../Skeleton.js";
import { PRIMARY } from "../vacancies/detail/VacancyDetailStates.js";
import { IconAlert, IconBell, IconRefresh } from "./icons.js";

const CHANNELS: NotificationChannel[] = ["in_app", "telegram", "push", "email"];

/** Rolga tegishli turlar: nomzodga "yangi ariza" (ish beruvchi hodisasi) ko'rsatilmaydi va h.k. */
const TYPES_BY_ROLE: Record<string, NotificationType[]> = {
  job_seeker: ["application_status_changed", "new_vacancy_match", "system"],
  employer: ["new_application", "system"],
};

type Status = "loading" | "ready" | "error";

/**
 * Sozlamalar — mavjud `GET/PUT /api/notifications/preferences`. Har bir almashtirgich
 * darhol saqlanadi (faqat o'sha tur×kanal yuboriladi), xato bo'lsa qaytariladi.
 * Serverda sozlanmagan kanal — o'chiq va bosilmaydi (xabar yetkazilmaydi).
 */
export function NotificationSettings({ token, role }: { token: string; role: string | null }) {
  const t = useT();
  const s = t.notificationsPage.settings;
  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [notice, setNotice] = useState<{ kind: "saved" | "error"; key: number } | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const push = usePush(token);
  const types = TYPES_BY_ROLE[role ?? ""] ?? [...NOTIFICATION_TYPES];

  const load = useCallback(async () => {
    setStatus("loading");
    const list = await fetchNotificationPrefs(token);
    // Server har doim tur×kanal jadvalini qaytaradi — bo'sh ro'yxat = so'rov muvaffaqiyatsiz
    if (list.length === 0) {
      setStatus("error");
      return;
    }
    setPrefs(list);
    setStatus("ready");
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (type: NotificationType, channel: NotificationChannel) => {
    const pref = prefsRef.current.find((p) => p.notificationType === type && p.channel === channel);
    if (!pref || !pref.available) return;
    const next = !pref.isEnabled;
    const apply = (value: boolean) =>
      setPrefs((prev) => prev.map((p) => (p.notificationType === type && p.channel === channel ? { ...p, isEnabled: value } : p)));
    apply(next);
    try {
      await saveNotificationPrefs(token, [{ notificationType: type, channel, isEnabled: next }]);
      setNotice({ kind: "saved", key: Date.now() });
    } catch {
      apply(!next);
      setNotice({ kind: "error", key: Date.now() });
    }
  };

  const pushLabel = {
    loading: "…",
    unsupported: t.notifications.push.unsupported,
    unconfigured: t.notifications.push.notConfigured,
    blocked: t.notifications.push.blocked,
    off: "",
    on: t.notifications.push.enabled,
  }[push.state];

  return (
    <div className="space-y-5">
      <section aria-labelledby="notification-settings-title" className="rounded-3xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <h2 id="notification-settings-title" className="font-display text-[17px] font-bold tracking-tight text-ink">
              {s.title}
            </h2>
            <p className="mt-1 max-w-xl text-[13.5px] leading-snug text-dusk">{s.hint}</p>
          </div>
          <p aria-live="polite" className="min-h-[20px] text-[13px] font-semibold">
            {notice?.kind === "saved" && <span className="text-growth">{s.saved}</span>}
            {notice?.kind === "error" && <span className="text-danger">{s.saveError}</span>}
          </p>
        </div>

        {status === "loading" && (
          <div aria-busy="true" className="space-y-4 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <Skeleton key={j} className="h-11 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <IconAlert size={22} />
            </span>
            <p className="mt-3 font-display text-[16px] font-bold text-ink">{s.loadError}</p>
            <button type="button" onClick={() => void load()} className={`${PRIMARY} mt-5`}>
              <IconRefresh size={16} />
              {s.retry}
            </button>
          </div>
        )}

        {status === "ready" && (
          <ul className="divide-y divide-line">
            {types.map((type) => {
              const headingId = `notification-pref-${type}`;
              return (
                <li key={type} className="p-5">
                  <h3 id={headingId} className="text-[14.5px] font-semibold text-ink">
                    {t.notifications.types[type]}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-dusk">{s.typeHints[type]}</p>
                  <ul className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
                    {CHANNELS.map((channel) => {
                      const pref = prefs.find((p) => p.notificationType === type && p.channel === channel);
                      const available = pref?.available ?? false;
                      const checked = available && (pref?.isEnabled ?? false);
                      return (
                        <li key={channel}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-describedby={headingId}
                            disabled={!available}
                            onClick={() => void toggle(type, channel)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-signal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:bg-surface-2/60 disabled:hover:border-line"
                          >
                            <span className="min-w-0">
                              <span className="block text-[13.5px] font-medium text-ink">{t.notifications.channels[channel]}</span>
                              {!available && <span className="block text-[11.5px] text-dusk">{s.unavailable}</span>}
                            </span>
                            <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-signal" : "bg-line"}`}>
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
                              />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="notification-push-title" className="rounded-3xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-signal-soft text-signal">
            <IconBell size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="notification-push-title" className="font-display text-[16px] font-bold tracking-tight text-ink">
              {t.notifications.push.title}
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-dusk">{t.notifications.push.hint}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {push.state === "on" ? (
                <button
                  type="button"
                  onClick={() => void push.disable()}
                  disabled={push.busy}
                  className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-60"
                >
                  {t.notifications.push.disable}
                </button>
              ) : (
                push.state === "off" && (
                  <button type="button" onClick={() => void push.enable()} disabled={push.busy} className={PRIMARY}>
                    {t.notifications.push.enable}
                  </button>
                )
              )}
              {pushLabel && <span className="text-[13px] text-dusk">{pushLabel}</span>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
