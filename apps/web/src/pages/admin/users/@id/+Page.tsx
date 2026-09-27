import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AdminShell } from "../../../../components/AdminShell.js";
import { AdminError } from "../../../../components/admin/AdminStates.js";
import { Flag } from "../../../../components/admin/VacancyReviewPanel.js";
import { useT, useHref, useLocale } from "../../../../lib/i18n/index.js";
import { useAuth } from "../../../../components/AuthContext.js";
import { fetchAdminUser } from "../../../../lib/apiExtra.js";
import { useAdminResource } from "../../../../lib/admin/useAdminResource.js";
import type { AdminUserDetail } from "../../../../lib/types.js";

/**
 * `/admin/users/:id` — foydalanuvchi kartochkasi: hisob holati, kompaniya, e'lonlar, arizalar,
 * sharhlar, murojaatlar va xavfsizlik hodisalari bir joyda (faqat admin).
 */
export default function Page() {
  const id = String(usePageContext().routeParams?.id ?? "");
  return (
    <AdminShell>
      <UserCard key={id} id={id} />
    </AdminShell>
  );
}

function UserCard({ id }: { id: string }) {
  const t = useT();
  const u = t.admin.userDetail;
  const l = useHref();
  const { accessToken, status, user } = useAuth();
  const token = status === "authed" && user?.role === "admin" ? accessToken : null;
  const { state, reload } = useAdminResource(token ? (signal) => fetchAdminUser(token, id, signal) : null, id);

  return (
    <div className="space-y-5">
      <a href={l("/admin/users")} className="text-sm font-medium text-dusk hover:text-signal">
        ← {u.back}
      </a>
      {state.kind === "error" ? (
        <AdminError title={u.notFound} text={t.admin.common.loadErrorText} retry={t.admin.common.retry} onRetry={reload} />
      ) : state.kind === "loading" ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" aria-busy="true" />
      ) : (
        <Detail data={state.data} />
      )}
    </div>
  );
}

function Detail({ data }: { data: AdminUserDetail }) {
  const t = useT();
  const u = t.admin.userDetail;
  const l = useHref();
  const { locale } = useLocale();
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale);

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold text-ink">{data.name ?? data.email}</h2>
            <p className="text-sm text-dusk">
              {[data.name ? data.email : null, data.headline, data.regionName].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Flag>{t.admin.roleNames[data.role as keyof typeof t.admin.roleNames] ?? data.role}</Flag>
            {data.isBlocked && <Flag tone="danger">{t.admin.users.blocked}</Flag>}
            {data.isEmailVerified && <Flag>{u.emailVerified}</Flag>}
            {data.telegramLinked && <Flag>{u.telegram}</Flag>}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-dusk">{u.phone}</dt>
            <dd className="font-mono text-ink">{data.phoneMasked ?? u.none}</dd>
          </div>
          <div>
            <dt className="text-xs text-dusk">{u.registered}</dt>
            <dd className="text-ink">{date(data.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-dusk">{u.applications}</dt>
            <dd className="text-ink">{data.applications.total}</dd>
          </div>
        </dl>
      </section>

      {data.companies.length > 0 && (
        <Block title={u.companies}>
          {data.companies.map((c) => (
            <Row key={c.id}>
              <a href={l(`/companies/${c.slug}`)} className="font-semibold text-ink hover:text-signal">
                {c.name}
              </a>
              <span className="flex gap-1">
                {c.isVerified && <Flag>{t.admin.companies.verified}</Flag>}
                {!c.isVerified && c.verificationRequestedAt && <Flag tone="warn">{t.admin.companiesExtra.requested}</Flag>}
              </span>
            </Row>
          ))}
        </Block>
      )}

      {(data.role === "employer" || data.vacancies.total > 0) && (
        <Block title={`${u.vacancies} · ${u.showing(data.vacancies.items.length, data.vacancies.total)}`}>
          {data.vacancies.items.length === 0 ? (
            <Empty text={u.none} />
          ) : (
            data.vacancies.items.map((v) => (
              <Row key={v.id}>
                {v.status === "active" ? (
                  <a href={l(`/vacancies/${v.slug}`)} className="font-medium text-ink hover:text-signal">
                    {v.title}
                  </a>
                ) : (
                  <span className="font-medium text-ink">{v.title}</span>
                )}
                <span className="text-xs text-dusk">
                  {t.admin.statuses.vacancy[v.status]}
                  {v.autoApprovedAt ? ` · ${t.admin.moderation.autoApproved}` : ""} · {date(v.createdAt)}
                </span>
              </Row>
            ))
          )}
        </Block>
      )}

      {(data.role === "job_seeker" || data.applications.total > 0) && (
        <Block title={`${u.applications} · ${u.showing(data.applications.items.length, data.applications.total)}`}>
          {data.applications.items.length === 0 ? (
            <Empty text={u.none} />
          ) : (
            data.applications.items.map((a) => (
              <Row key={a.id}>
                <span className="min-w-0">
                  <span className="font-medium text-ink">{a.vacancyTitle}</span>
                  <span className="text-dusk"> · {a.companyName}</span>
                </span>
                <span className="text-xs text-dusk">
                  {a.status} · {date(a.createdAt)}
                </span>
              </Row>
            ))
          )}
        </Block>
      )}

      {data.reviews.length > 0 && (
        <Block title={u.reviews}>
          {data.reviews.map((r) => (
            <Row key={r.id}>
              <span className="min-w-0">
                <span className="font-medium text-ink">{r.companyName}</span>
                <span className="font-mono text-gold-deep"> {"★".repeat(r.rating)}</span>
                {r.comment && <span className="block truncate text-xs text-dusk">{r.comment}</span>}
              </span>
              <span className="text-xs text-dusk">{t.admin.statuses.review[r.status]}</span>
            </Row>
          ))}
        </Block>
      )}

      {data.tickets.length > 0 && (
        <Block title={u.tickets}>
          {data.tickets.map((tk) => (
            <Row key={tk.id}>
              <span className="min-w-0">
                <span className="font-medium text-ink">{t.admin.support.kinds[tk.kind]}</span>
                <span className="block truncate text-xs text-dusk">{tk.message}</span>
              </span>
              <span className="text-xs text-dusk">
                {t.admin.support.statuses[tk.status]} · {date(tk.createdAt)}
              </span>
            </Row>
          ))}
        </Block>
      )}

      <Block title={u.security}>
        {data.securityEvents.length === 0 ? (
          <Empty text={u.none} />
        ) : (
          data.securityEvents.map((e) => (
            <Row key={e.id}>
              <span className="text-ink">{t.admin.recovery.eventType[e.type] ?? e.type}</span>
              <span className="text-xs text-dusk">{new Date(e.createdAt).toLocaleString(locale)}</span>
            </Row>
          ))
        )}
      </Block>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dusk">{title}</h3>
      <ul className="divide-y divide-line/60">{children}</ul>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">{children}</li>;
}

function Empty({ text }: { text: string }) {
  return <li className="py-2 text-sm text-dusk">{text}</li>;
}
