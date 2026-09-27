import React, { useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  AdminShell,
  AdminTable,
  AdminFilters,
  AdminSearchInput,
  AdminSelect,
  Pager,
  RowButton,
} from "../../../components/AdminShell.js";
import { AdminError, AdminNotice } from "../../../components/admin/AdminStates.js";
import { RecoveryRequests } from "../../../components/admin/RecoveryRequests.js";
import { useT, useLocale, useHref } from "../../../lib/i18n/index.js";
import { useAuth } from "../../../components/AuthContext.js";
import { fetchAdminUsers, setUserBlocked, setUserRole } from "../../../lib/apiExtra.js";
import { useAdminResource } from "../../../lib/admin/useAdminResource.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import type { AdminUser } from "../../../lib/types.js";

export default function Page() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  // Ko'rinish query parametrida — yangi sahifa yaratilmaydi (audit R3, D-049, D-063)
  const view = search.view === "recovery" ? "recovery" : "users";

  return (
    <AdminShell>
      <ViewToggle view={view} />
      {view === "recovery" ? <RecoveryRequests /> : <UsersTable />}
    </AdminShell>
  );
}

/** Foydalanuvchilar / tiklash so'rovlari almashtirgichi (bitta sahifa ichida). */
function ViewToggle({ view }: { view: "users" | "recovery" }) {
  const t = useT();
  const l = useHref();
  const tabs = [
    { key: "users" as const, href: "/admin/users", label: t.admin.recovery.viewUsers },
    { key: "recovery" as const, href: "/admin/users?view=recovery", label: t.admin.recovery.viewRequests },
  ];

  return (
    <nav aria-label={t.admin.recovery.viewLabel} className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={l(tab.href)}
          aria-current={tab.key === view ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            tab.key === view
              ? "bg-signal/10 text-signal dark:text-indigo-300"
              : "text-dusk hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

function UsersTable() {
  const t = useT();
  const l = useHref();
  const { locale } = useLocale();
  const { accessToken, status, user } = useAuth();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { notice, show } = useNotice();

  const token = status === "authed" && user?.role === "admin" ? accessToken : null;
  // Xato bo'sh jadval bo'lib ko'rinmaydi, eski javob yangi filtr ustiga yozilmaydi (audit ISSUE-021)
  const { state, pending, reload } = useAdminResource(
    token ? (signal) => fetchAdminUsers(token, { text: query, role, page }, signal) : null,
    JSON.stringify({ query, role, page })
  );

  async function act(row: AdminUser, action: (token: string) => Promise<unknown>, confirmFirst: boolean) {
    if (!token || busyId) return;
    if (confirmFirst && !window.confirm(t.admin.common.confirmAction)) return;
    setBusyId(row.id);
    try {
      await action(token);
      show("success", t.admin.common.done);
      reload();
    } catch (err) {
      show("error", errorText(err, t.admin.common.failed, locale));
    } finally {
      setBusyId(null);
    }
  }

  const roleLabel: Record<string, string> = {
    job_seeker: t.admin.overview.seekers,
    employer: t.admin.overview.employers,
    admin: t.navExtra.admin,
    moderator: t.admin.roleNames.moderator,
    content_editor: t.admin.roleNames.content_editor,
    content_author: t.admin.roleNames.content_author,
  };

  const data = state.kind === "ready" ? state.data : null;

  return (
    <div>
      <AdminFilters>
        <AdminSearchInput
          value={text}
          onChange={setText}
          onSubmit={() => {
            setPage(1);
            setQuery(text.trim());
          }}
          placeholder={t.admin.users.searchPlaceholder}
        />
        <AdminSelect
          label={t.admin.users.role}
          value={role}
          onChange={(v) => {
            setPage(1);
            setRole(v);
          }}
          options={[
            { value: "", label: t.admin.users.allRoles },
            { value: "job_seeker", label: roleLabel.job_seeker },
            { value: "employer", label: roleLabel.employer },
            { value: "admin", label: roleLabel.admin },
          ]}
        />
      </AdminFilters>

      {notice && (
        <div className="mb-3">
          <AdminNotice notice={notice} />
        </div>
      )}

      {state.kind === "error" ? (
        <AdminError
          title={t.admin.common.loadErrorTitle}
          text={t.admin.common.loadErrorText}
          retry={t.admin.common.retry}
          onRetry={reload}
        />
      ) : state.kind === "loading" ? (
        <div className="h-48 animate-pulse rounded-xl border border-line bg-surface-2" aria-busy="true" />
      ) : data && data.items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-dusk">
          {t.admin.users.empty}
        </p>
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : undefined} aria-busy={pending || undefined}>
          <AdminTable
            head={
              <>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.users.role}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.users.applications}</th>
                <th className="px-4 py-2.5 font-semibold">{t.admin.users.registered}</th>
                <th className="px-4 py-2.5 font-semibold">&nbsp;</th>
              </>
            }
          >
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">
                  <a href={l(`/admin/users/${row.id}`)} className="block font-semibold text-ink transition-colors hover:text-signal">
                    {row.name ?? row.email}
                  </a>
                  <span className="block text-xs text-dusk">{row.email}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {row.isBlocked && <Tag tone="warn">{t.admin.users.blocked}</Tag>}
                    {row.isPhoneVerified && <Tag>{t.admin.users.phoneVerified}</Tag>}
                    {row.telegramLinked && <Tag>{t.admin.users.telegram}</Tag>}
                    {row.companyName && <Tag>{row.companyName}</Tag>}
                  </span>
                </td>
                <td className="px-4 py-3 text-dusk">{roleLabel[row.role] ?? row.role}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-dusk">{row.applicationCount}</td>
                <td className="px-4 py-3 text-dusk">{new Date(row.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <RowButton
                      onClick={() => void act(row, (tk) => setUserBlocked(tk, row.id, !row.isBlocked), !row.isBlocked)}
                      tone={row.isBlocked ? "primary" : "danger"}
                    >
                      {row.isBlocked ? t.admin.users.unblock : t.admin.users.block}
                    </RowButton>
                    {row.role !== "admin" && (
                      <RowButton onClick={() => void act(row, (tk) => setUserRole(tk, row.id, "admin"), true)}>
                        {t.admin.users.makeAdmin}
                      </RowButton>
                    )}
                    {row.role !== "employer" && (
                      <RowButton onClick={() => void act(row, (tk) => setUserRole(tk, row.id, "employer"), true)}>
                        {t.admin.users.makeEmployer}
                      </RowButton>
                    )}
                    {row.role !== "job_seeker" && (
                      <RowButton onClick={() => void act(row, (tk) => setUserRole(tk, row.id, "job_seeker"), true)}>
                        {t.admin.users.makeSeeker}
                      </RowButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        </div>
      )}

      {data && <Pager page={data.page} pageCount={data.pageCount} total={data.total} onChange={setPage} />}
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        tone === "warn" ? "bg-gold/20 text-gold-deep" : "bg-surface-2 text-dusk"
      }`}
    >
      {children}
    </span>
  );
}
