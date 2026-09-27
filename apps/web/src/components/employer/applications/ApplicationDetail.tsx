import React, { useId, useMemo, useRef, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { formatDate, formatNumber, formatRelativeDays } from "../../../lib/format.js";
import { regionLabel, type EmployerApplicationVM } from "../../../lib/employer/applications/adapter.js";
import { applicationResumeFileUrl, openProtectedFile } from "../../../lib/files/resume.js";
import { ActionsMenu, type ActionItem } from "../../ActionsMenu.js";
import { ApplicationStatusPill } from "./ApplicationStatusPill.js";
import { CandidateAvatar } from "./CandidateAvatar.js";
import { IconArrowLeft, IconCalendar, IconChat, IconExternal, IconFile, IconMail, IconPhone, IconPin, IconSend, IconTelegram, Spinner } from "./icons.js";

type TabKey = "resume" | "letter" | "activity";

/** "2021-03-01T…" → "03.2021" (oy nomlari brauzer ICU'da o'zbekchada yo'q — raqamli ko'rinish barqaror). */
const monthYear = (iso: string | null) => (iso ? `${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/**
 * Nomzodning PDF rezyume fayli — manzil emas, avtorizatsiyali yuklab olish (audit R3, D-058 / files-xss-2):
 * fayl `GET /api/resume-files/application/:id` orqali Bearer bilan olinadi va yangi oynada ochiladi.
 */
function ResumeFileRow({ application: a, token }: { application: EmployerApplicationVM; token: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!a.hasResumeFile) return null;
  return (
    <div data-testid="application-resume-file" className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
        <IconFile size={18} />
      </span>
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-ink">{t.profile.resumeSection} · PDF</span>
      <button
        type="button"
        data-action="open-resume-file"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          openProtectedFile(applicationResumeFileUrl(a.id), token)
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-signal transition-colors hover:bg-signal-soft disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300"
      >
        {busy ? <Spinner size={15} /> : <IconExternal size={15} />}
        {t.profile.view}
      </button>
      {failed && (
        <p role="alert" className="w-full text-[13px] text-danger">
          {t.profileHub.states.loadError}
        </p>
      )}
    </div>
  );
}

function ResumePanel({ application: a, token }: { application: EmployerApplicationVM; token: string }) {
  const t = useT();
  const d = t.employerApplicationsPage.detail;
  const r = a.resume;
  if (!r) {
    return (
      <div className="space-y-5">
        <ResumeFileRow application={a} token={token} />
        <p data-testid="application-no-resume" className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[14px] text-dusk">
          {d.noResume}
        </p>
      </div>
    );
  }
  return (
    <div data-testid="application-resume" className="space-y-5">
      <ResumeFileRow application={a} token={token} />
      {(r.title || r.desiredSalary) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
          {r.title && (
            <span className="inline-flex min-w-0 items-center gap-2.5 text-[14.5px] font-semibold text-ink">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal dark:text-indigo-300">
                <IconFile size={18} />
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{r.title}</span>
            </span>
          )}
          {r.desiredSalary && (
            <span className="text-[13px] text-dusk">
              {d.desiredSalary}: <span className="font-mono font-semibold text-growth">{`${formatNumber(r.desiredSalary)} ${t.fmt.currency}`}</span>
            </span>
          )}
        </div>
      )}
      {r.summary && (
        <section>
          <h3 className="text-[14px] font-semibold text-ink">{d.summary}</h3>
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink/80 [overflow-wrap:anywhere]">{r.summary}</p>
        </section>
      )}
      {r.skills.length > 0 && (
        <section>
          <h3 className="text-[14px] font-semibold text-ink">{d.skills}</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.skills.map((skill) => (
              <li key={skill} className="rounded-lg border border-line bg-surface-2/60 px-2.5 py-1 text-[12.5px] font-medium text-ink/85">
                {skill}
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.experience.length > 0 && (
        <section>
          <h3 className="text-[14px] font-semibold text-ink">{d.experience}</h3>
          <ul className="mt-2 space-y-3">
            {r.experience.map((e, i) => (
              <li key={i} className="border-l-2 border-signal/30 pl-3">
                <p className="text-[14px] font-medium text-ink [overflow-wrap:anywhere]">{[e.position, e.companyName].filter(Boolean).join(" · ")}</p>
                {e.startDate && (
                  <p className="text-[12.5px] tabular-nums text-dusk">
                    {monthYear(e.startDate)} – {e.isCurrent || !e.endDate ? d.present : monthYear(e.endDate)}
                  </p>
                )}
                {e.description && <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/75 [overflow-wrap:anywhere]">{e.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.education.length > 0 && (
        <section>
          <h3 className="text-[14px] font-semibold text-ink">{d.education}</h3>
          <ul className="mt-2 space-y-2">
            {r.education.map((e, i) => (
              <li key={i} className="text-[14px] text-ink/85">
                <span className="font-medium text-ink">{e.institution}</span>
                {[e.degree, e.field].filter(Boolean).length > 0 && <span className="text-dusk"> · {[e.degree, e.field].filter(Boolean).join(", ")}</span>}
                {e.startYear && (
                  <span className="ml-1 text-[12.5px] tabular-nums text-dusk">
                    ({e.startYear}–{e.endYear ?? d.present})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActivityPanel({ application: a }: { application: EmployerApplicationVM }) {
  const t = useT();
  const p = t.employerApplicationsPage;
  const { locale } = useLocale();
  // Boshlang'ich "yuborildi" yozuvi ariza sanasi bilan takrorlanmaydi
  const events = [
    { key: "applied", label: p.detail.activityApplied, at: a.createdAt },
    ...a.history.filter((h) => !(h.to === "sent" && !h.from)).map((h, i) => ({ key: `h${i}`, label: p.detail.activityStatus(p.status[h.to]), at: h.at })),
  ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
  return (
    <ol data-testid="application-activity" className="relative space-y-4 border-l border-line pl-5">
      {events.map((event, i) => (
        <li key={event.key} className="relative">
          <span aria-hidden className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${i === 0 ? "bg-signal" : "bg-line"}`} />
          <p className="text-[14px] font-medium text-ink">{event.label}</p>
          <p className="text-[12.5px] text-dusk">{formatDate(event.at, locale)}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Markaziy panel — TANLANGAN ARIZA (nomzod + aniq vakansiya + shu arizaning holati).
 * Har bir blok faqat backend ma'lumoti bo'lsa chiziladi: rezyume, xat, telefon, hudud...
 */
export function ApplicationDetail({
  application: a,
  token,
  titleRef,
  onBack,
  onMessage,
}: {
  application: EmployerApplicationVM;
  token: string;
  /** Telefon ekranida ariza ochilganda fokus shu sarlavhaga ko'chadi (audit R3, gap5-4). */
  titleRef?: React.RefObject<HTMLHeadingElement>;
  onBack: () => void;
  onMessage: () => void;
}) {
  const t = useT();
  const p = t.employerApplicationsPage;
  const d = p.detail;
  const { locale } = useLocale();
  const l = useHref();
  const titleId = useId();
  const tabsId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs = useMemo<TabKey[]>(() => (a.coverLetter ? ["resume", "letter", "activity"] : ["resume", "activity"]), [a.coverLetter]);
  const [tab, setTab] = useState<TabKey>("resume");
  const activeTab = tabs.includes(tab) ? tab : "resume";

  const region = regionLabel(a.candidate.region, locale);
  const posted = formatRelativeDays(a.createdAt, t.fmt);
  const vacancyPublic = a.vacancy.status === "active" && a.vacancy.slug ? l(`/vacancies/${a.vacancy.slug}`) : null;

  const menu: ActionItem[] = [
    { key: "message", label: p.sidebar.message, icon: <IconChat size={16} />, onSelect: onMessage },
    ...(vacancyPublic ? [{ key: "vacancy", label: p.sidebar.openVacancy, icon: <IconExternal size={16} />, href: vacancyPublic }] : []),
    ...(a.candidate.email ? [{ key: "email", label: a.candidate.email, icon: <IconMail size={16} />, href: `mailto:${a.candidate.email}` }] : []),
    ...(a.candidate.phone ? [{ key: "phone", label: a.candidate.phone, icon: <IconPhone size={16} />, href: `tel:${a.candidate.phone.replace(/[^\d+]/g, "")}` }] : []),
  ];

  const move = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    setTab(tabs[next]);
  };

  const info = [
    a.candidate.email && { key: "email", icon: <IconMail size={17} />, label: d.email, value: a.candidate.email, href: `mailto:${a.candidate.email}` },
    a.candidate.phone && { key: "phone", icon: <IconPhone size={17} />, label: d.phone, value: a.candidate.phone, href: `tel:${a.candidate.phone.replace(/[^\d+]/g, "")}` },
    region && { key: "region", icon: <IconPin size={17} />, label: d.region, value: region },
  ].filter((row): row is { key: string; icon: React.ReactElement; label: string; value: string; href?: string } => Boolean(row));

  return (
    <article aria-labelledby={titleId} data-testid="application-detail" data-application={a.id} className="rounded-2xl border border-line bg-surface shadow-xs">
      <div className="border-b border-line p-4 sm:p-6">
        <button
          type="button"
          onClick={onBack}
          data-testid="applications-back"
          className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-md px-1 text-[13.5px] font-medium text-dusk transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal lg:hidden"
        >
          <IconArrowLeft size={16} />
          {p.back}
        </button>
        <div className="flex items-start gap-3.5 sm:gap-4">
          <CandidateAvatar name={a.candidate.name} src={a.candidate.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2
                id={titleId}
                ref={titleRef}
                tabIndex={-1}
                className="line-clamp-2 font-display text-[20px] font-bold leading-tight text-ink [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:text-[22px]"
              >
                {a.candidate.name}
              </h2>
              <ApplicationStatusPill status={a.status} />
            </div>
            {a.candidate.headline && <p className="mt-1 text-[14.5px] text-dusk [overflow-wrap:anywhere]">{a.candidate.headline}</p>}
          </div>
          <ActionsMenu label={d.menu(a.candidate.name)} items={menu} />
        </div>

        <ul data-testid="application-chips" className="mt-4 flex flex-wrap gap-2">
          {region && (
            <li data-chip="region" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-[12.5px] text-ink/80">
              <IconPin size={14} className="text-dusk" />
              {region}
            </li>
          )}
          {a.candidate.isOpenToWork && (
            <li data-chip="open" className="inline-flex items-center gap-1.5 rounded-lg bg-growth/10 px-2.5 py-1 text-[12.5px] font-medium text-growth">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-growth" />
              {d.openToWork}
            </li>
          )}
          {a.source === "telegram" && (
            <li data-chip="telegram" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-[12.5px] text-ink/80">
              <IconTelegram size={14} className="text-dusk" />
              {d.viaTelegram}
            </li>
          )}
          {posted && (
            <li data-chip="applied" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-[12.5px] text-ink/80" suppressHydrationWarning>
              <IconCalendar size={14} className="text-dusk" />
              {d.appliedAgo(posted)}
            </li>
          )}
        </ul>
      </div>

      <div className="p-4 sm:p-6">
        <div data-testid="application-banner" className="flex items-start gap-3 rounded-xl bg-signal-soft/50 px-4 py-3">
          <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-signal dark:text-indigo-300">
            <IconSend size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink [overflow-wrap:anywhere]">{d.appliedBanner(a.vacancy.title)}</p>
            <p className="mt-0.5 text-[12.5px] text-dusk">{d.appliedOn(formatDate(a.createdAt, locale))}</p>
          </div>
        </div>

        <div role="tablist" aria-label={d.tabsLabel} className="mt-5 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
          {tabs.map((key, i) => {
            const selected = key === activeTab;
            return (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={`${tabsId}-tab-${key}`}
                type="button"
                role="tab"
                data-detail-tab={key}
                aria-selected={selected}
                aria-controls={`${tabsId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") move(i + 1);
                  else if (e.key === "ArrowLeft") move(i - 1);
                  else return;
                  e.preventDefault();
                }}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                  selected ? "border-signal font-semibold text-signal dark:text-indigo-300" : "border-transparent font-medium text-dusk hover:text-ink"
                }`}
              >
                {d.tabs[key]}
              </button>
            );
          })}
        </div>
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${activeTab}`} className="pt-5">
          {activeTab === "resume" && <ResumePanel application={a} token={token} />}
          {activeTab === "letter" && a.coverLetter && (
            <div data-testid="application-letter" className="whitespace-pre-line rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-[14px] leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
              {a.coverLetter}
            </div>
          )}
          {activeTab === "activity" && <ActivityPanel application={a} />}
        </div>

        {info.length > 0 && (
          <section data-testid="application-info" className="mt-6">
            <h3 className="text-[15px] font-semibold text-ink">{d.infoTitle}</h3>
            <dl className="mt-2.5 grid gap-x-6 gap-y-2.5 rounded-xl border border-line px-4 py-3.5 sm:grid-cols-2">
              {/* `dl` ichida faqat `dt`/`dd` juftligi bo'lgan `div` bo'ladi — ikonka `dd` ichida (audit R3, a11y-ui) */}
              {info.map((row) => (
                <div key={row.key} data-info={row.key} className="min-w-0">
                  <dt className="sr-only">{row.label}</dt>
                  <dd className="flex min-w-0 items-center gap-2.5 text-[14px] text-ink">
                    <span aria-hidden className="shrink-0 text-dusk">
                      {row.icon}
                    </span>
                    {row.href ? (
                      <a href={row.href} className="min-w-0 truncate rounded-sm transition-colors hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                        {row.value}
                      </a>
                    ) : (
                      <span className="min-w-0 truncate">{row.value}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </article>
  );
}
