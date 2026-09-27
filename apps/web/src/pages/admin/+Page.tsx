import React, { useEffect, useState } from "react";
import { AdminShell, rememberAdminBilling } from "../../components/AdminShell.js";
import { AdminError } from "../../components/admin/AdminStates.js";
import { useT, useLocale, useHref } from "../../lib/i18n/index.js";
import { useAuth } from "../../components/AuthContext.js";
import { formatNumber } from "../../lib/format.js";
import {
  fetchAdminOverview,
  fetchBroadcasts,
  reindexSearch,
  runAlertsNow,
  runAutoApproveNow,
  sendBroadcast,
} from "../../lib/apiExtra.js";
import { useAdminResource } from "../../lib/admin/useAdminResource.js";
import { errorText } from "../../lib/admin/useNotice.js";

/** Admin bosh sahifasi: ko'rsatkichlar, 14 kunlik dinamika, xizmat amallari. */
export default function Page() {
  return (
    <AdminShell>
      <Overview />
    </AdminShell>
  );
}

function Overview() {
  const t = useT();
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const token = status === "authed" && user?.role === "admin" ? accessToken : null;
  // Xatoda abadiy skelet emas — xato holati va haqiqiy qayta so'rov (audit ISSUE-021)
  const { state, reload } = useAdminResource(token ? (signal) => fetchAdminOverview(token, signal) : null, "overview");

  // Monetizatsiya bayrog'i qobiqqa uzatiladi: o'chiq bo'lsa to'lovlar bo'limi ko'rinmaydi (audit R3, D-065)
  const billingEnabled = state.kind === "ready" ? (state.data as { billingEnabled?: boolean }).billingEnabled === true : null;
  useEffect(() => {
    if (billingEnabled !== null) rememberAdminBilling(billingEnabled);
  }, [billingEnabled]);

  async function run(action: "reindex" | "alerts" | "autoApprove") {
    if (!token) return;
    // Indeksni qayta qurish va xabarnoma sweep'i — butun bazaga ta'sir qiladi (audit R3, admin-staff-12)
    if (!window.confirm(`${t.admin.common.confirmAction}\n\n${action === "reindex" ? t.admin.overview.reindex : action === "alerts" ? t.admin.overview.runAlerts : t.admin.moderation.runNow}`)) return;
    setBusy(true);
    setMessage(null);
    try {
      if (action === "reindex") {
        const r = await reindexSearch(token);
        setMessage({ tone: "success", text: t.admin.overview.reindexDone(r.indexed) });
      } else if (action === "alerts") {
        const r = await runAlertsNow(token);
        setMessage({ tone: "success", text: t.admin.overview.alertsDone(r.checked) });
      } else {
        const r = await runAutoApproveNow(token);
        setMessage({ tone: "success", text: t.admin.moderation.runDone(r.vacancies, r.reviews) });
        reload();
      }
    } catch (err) {
      setMessage({ tone: "error", text: errorText(err, t.admin.common.failed, locale) });
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "error") {
    return (
      <AdminError
        title={t.admin.common.loadErrorTitle}
        text={t.admin.common.loadErrorText}
        retry={t.admin.common.retry}
        onRetry={reload}
      />
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  const data = state.data;
  const autoHours = data.moderation?.autoApproveHours ?? 0;
  const maxDay = Math.max(1, ...data.chart.map((d) => Math.max(d.users, d.applications)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t.admin.overview.users}
          value={formatNumber(data.users.total)}
          details={[
            `${data.users.seekers} ${t.admin.overview.seekers}`,
            `${data.users.employers} ${t.admin.overview.employers}`,
            ...(data.users.blocked > 0 ? [`${data.users.blocked} ${t.admin.overview.blocked}`] : []),
          ]}
        />
        <MetricCard label={t.admin.overview.newThisWeek} value={formatNumber(data.users.newThisWeek)} />
        <MetricCard
          label={t.admin.overview.companies}
          value={formatNumber(data.companies.total)}
          details={[`${data.companies.verified} ${t.admin.overview.verified}`]}
        />
        <MetricCard
          label={t.admin.overview.activeVacancies}
          value={formatNumber(data.vacancies.active)}
          details={data.vacancies.moderation > 0 ? [`${data.vacancies.moderation} ${t.admin.overview.onModeration}`] : []}
        />
        {/* Moderatsiya navbati: admin ko'rmasa muddat tugagach avtomatik tasdiqlanadi */}
        <MetricCard
          label={t.admin.moderation.queue}
          value={formatNumber(data.vacancies.moderation + data.reviews.pending)}
          href="/admin/vacancies?status=moderation"
          details={[
            t.admin.moderation.queueDetails(data.vacancies.moderation, data.reviews.pending),
            autoHours > 0 ? t.admin.moderation.autoApproveHours(autoHours) : t.admin.moderation.autoApproveOff,
          ]}
        />
        <MetricCard label={t.admin.overview.supportOpen} value={formatNumber(data.support?.open ?? 0)} href="/admin/support" />
        <MetricCard
          label={t.admin.overview.verificationRequests}
          value={formatNumber(data.verificationRequests ?? 0)}
          href="/admin/companies?filter=requested"
        />
        <MetricCard
          label={t.admin.overview.autoApprovedUnreviewed}
          value={formatNumber(data.moderation?.autoApprovedUnreviewed ?? 0)}
          href="/admin/vacancies?status=auto"
        />
        <MetricCard
          label={t.admin.overview.applications}
          value={formatNumber(data.applications.total)}
          details={[`${data.applications.today} ${t.admin.overview.today}`]}
        />
        {/* Tushum kartasi faqat monetizatsiya yoqilganda (audit R3, D-065): platforma bepul */}
        {billingEnabled && (
          <MetricCard
            label={t.admin.overview.revenue}
            value={`${formatNumber(data.payments.revenue)} ${t.fmt.currency}`}
            details={[`${data.payments.paid} ${t.pricingExtra.statusPaid.toLowerCase()}`]}
            accent
          />
        )}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink">{t.admin.overview.chartTitle}</h2>
          <div className="flex items-center gap-4 text-xs text-dusk">
            <span className="flex items-center gap-1.5">
              <span className="chart-dot-a h-2.5 w-2.5 rounded-sm" /> {t.admin.overview.chartUsers}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="chart-dot-b h-2.5 w-2.5 rounded-sm" /> {t.admin.overview.chartApplications}
            </span>
          </div>
        </div>

        <div className="mt-5 flex h-40 items-end gap-1.5">
          {data.chart.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-0.5">
                {/* Ustunlar `global.css` dagi gradient + glow bilan chiziladi (tungi rejimda yonib turadi).
                    Qiymat 0 bo'lsa ham ingichka iz qoladi: bo'sh kun "yo'q" emas, "0" ekani ko'rinsin. */}
                <span
                  className="chart-bar chart-bar-a w-1/2"
                  style={{ height: `max(${(day.users / maxDay) * 100}%, 3px)` }}
                  title={`${t.admin.overview.chartUsers}: ${day.users}`}
                />
                <span
                  className="chart-bar chart-bar-b w-1/2"
                  style={{ height: `max(${(day.applications / maxDay) * 100}%, 3px)` }}
                  title={`${t.admin.overview.chartApplications}: ${day.applications}`}
                />
              </div>
              <span className="text-[10px] text-dusk">{day.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-base font-bold text-ink">{t.admin.overview.actions}</h2>
        <p className="mt-1 text-sm text-dusk">
          {t.admin.overview.searchEngine}: <span className="font-mono">{data.search.engine}</span>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("reindex")}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
          >
            {t.admin.overview.reindex}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("alerts")}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
          >
            {t.admin.overview.runAlerts}
          </button>
          {autoHours > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("autoApprove")}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
            >
              {t.admin.moderation.runNow}
            </button>
          )}
          {message && (
            <span role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-danger" : "text-growth"}`}>
              {message.text}
            </span>
          )}
        </div>
      </section>

      <BroadcastForm />
      {token && <BroadcastHistory token={token} />}
    </div>
  );
}

/** Oxirgi ommaviy xabarlar: kimga, qancha yetkazildi, holati. */
function BroadcastHistory({ token }: { token: string }) {
  const t = useT();
  const b = t.admin.broadcasts;
  const { locale } = useLocale();
  const { state } = useAdminResource((signal) => fetchBroadcasts(token, signal), "broadcasts");
  if (state.kind !== "ready") return null;
  const audience: Record<string, string> = {
    all: t.admin.overview.audienceAll,
    job_seeker: t.admin.overview.audienceSeekers,
    employer: t.admin.overview.audienceEmployers,
  };
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-base font-bold text-ink">{b.title}</h2>
      {state.data.items.length === 0 ? (
        <p className="mt-2 text-sm text-dusk">{b.empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line/60">
          {state.data.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-ink">{item.title}</span>
                <span className="text-dusk"> · {audience[item.audience] ?? item.audience}</span>
              </span>
              <span className="text-xs text-dusk">
                {b.status[item.status]} · {b.delivered(item.delivered, item.total)} · {new Date(item.createdAt).toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  details = [],
  accent = false,
  href,
}: {
  label: string;
  value: string;
  details?: string[];
  accent?: boolean;
  /** Karta bosilsa tegishli bo'limga o'tadi (navbat, murojaatlar). */
  href?: string;
}) {
  const l = useHref();
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-dusk">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-ink">{value}</p>
      {details.length > 0 && <p className="mt-1.5 text-xs text-dusk">{details.join(" · ")}</p>}
    </>
  );
  const cls = `block rounded-2xl border p-5 ${accent ? "border-signal/40 bg-signal/[0.05]" : "border-line bg-surface"}`;
  return href ? (
    <a href={l(href)} className={`${cls} transition-colors hover:border-signal/40`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function BroadcastForm() {
  const t = useT();
  const { locale } = useLocale();
  const { accessToken } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState<"all" | "job_seeker" | "employer">("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || title.trim().length < 3 || body.trim().length < 3) return;
    if (!window.confirm(t.admin.common.confirmAction)) return;

    setSending(true);
    setResult(null);
    try {
      // Server javobi darhol keladi, yuborish fonda davom etadi (audit ISSUE-054)
      const r = await sendBroadcast(accessToken, { title: title.trim(), body: body.trim(), role });
      setResult({ tone: "success", text: t.admin.overview.broadcastSent(r.sent) });
      setTitle("");
      setBody("");
    } catch (err) {
      setResult({ tone: "error", text: errorText(err, t.admin.common.failed, locale) });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-base font-bold text-ink">{t.admin.overview.broadcast}</h2>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-dusk" htmlFor="bc-title">
            {t.admin.overview.broadcastTitle}
          </label>
          <input
            id="bc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink focus:border-signal focus:bg-surface focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-dusk" htmlFor="bc-body">
            {t.admin.overview.broadcastBody}
          </label>
          <textarea
            id="bc-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink focus:border-signal focus:bg-surface focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-dusk" htmlFor="bc-role">
              {t.admin.overview.broadcastAudience}
            </label>
            <select
              id="bc-role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="mt-1 block rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none"
            >
              <option value="all">{t.admin.overview.audienceAll}</option>
              <option value="job_seeker">{t.admin.overview.audienceSeekers}</option>
              <option value="employer">{t.admin.overview.audienceEmployers}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={sending || title.trim().length < 3 || body.trim().length < 3}
            className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
          >
            {t.admin.overview.send}
          </button>
          {result && (
            <span role={result.tone === "error" ? "alert" : "status"} className={`text-sm ${result.tone === "error" ? "text-danger" : "text-growth"}`}>
              {result.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
