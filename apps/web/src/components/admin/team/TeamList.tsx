import React, { useRef, useState } from "react";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { formatDate } from "../../../lib/format.js";
import { revokeTeamInvite, updateTeamMember, type TeamData, type TeamMember } from "../../../lib/admin/team.js";
import type { TeamRole } from "../../../lib/admin/roles.js";
import { authorInitials } from "../../../lib/articles/adapter.js";
import { errorText, useNotice } from "../../../lib/admin/useNotice.js";
import { useDialog } from "../../../lib/useDialog.js";
import { ADMIN_CARD, ADMIN_INPUT, ADMIN_LABEL, ADMIN_PRIMARY, ADMIN_SECONDARY, AdminNotice } from "../AdminStates.js";
import { IconEdit, IconX, Spinner } from "../icons.js";
import { TeamRoleSelect } from "./TeamRoleSelect.js";

/**
 * Jamoa a'zolari (rol, faollik, ism va lavozim) va kutilayotgan takliflar.
 * O'zini faolsizlantirish va o'z rolini o'zgartirish mumkin emas (server ham rad etadi).
 */
export function TeamList({ token, data, onChanged }: { token: string; data: TeamData; onChanged: () => void }) {
  const t = useT();
  const team = t.contentAdmin.team;
  const roles = t.contentAdmin.roles;
  const { locale } = useLocale();
  const { notice, show } = useNotice();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const run = async (key: string, task: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await task();
      show("success", done);
      onChanged();
    } catch (err) {
      show("error", errorText(err, team.failed, locale));
    } finally {
      setBusy(null);
    }
  };

  const displayName = (m: TeamMember) => m.name ?? m.email;

  const changeRole = (member: TeamMember, role: TeamRole) => {
    if (role === member.role) return;
    if (!window.confirm(team.confirm.role(displayName(member), roles[role]))) return;
    void run(`role-${member.id}`, () => updateTeamMember(token, member.id, { role }), team.done.role);
  };

  const toggleBlock = (member: TeamMember) => {
    if (!member.isBlocked && !window.confirm(team.confirm.deactivate(displayName(member)))) return;
    void run(`block-${member.id}`, () => updateTeamMember(token, member.id, { isBlocked: !member.isBlocked }), member.isBlocked ? team.done.unblocked : team.done.blocked);
  };

  return (
    <div className="space-y-5">
      <AdminNotice notice={notice} />

      <section aria-labelledby="team-members-title" className={ADMIN_CARD} data-testid="team-members">
        <h3 id="team-members-title" className="font-display text-[16px] font-bold text-ink">
          {team.members.title} <span className="font-normal tabular-nums text-dusk">· {data.members.length}</span>
        </h3>
        <ul className="mt-3 divide-y divide-line">
          {data.members.map((member) => (
            <li key={member.id} data-member={member.email} className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-1 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white ${member.isBlocked ? "bg-dusk/60" : "bg-gradient-to-br from-signal to-violet-500"}`}>
                  {authorInitials(member.name ?? member.email)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
                    <span className="truncate">{member.name ?? <span className="font-normal italic text-dusk">{team.members.noName}</span>}</span>
                    {member.isSelf && <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[11px] font-semibold text-signal dark:text-indigo-300">{team.members.you}</span>}
                    <span
                      data-member-state={member.isBlocked ? "blocked" : "active"}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${member.isBlocked ? "bg-danger/10 text-danger" : "bg-growth/10 text-growth"}`}
                    >
                      {member.isBlocked ? team.members.blocked : team.members.active}
                    </span>
                  </p>
                  <p className="truncate text-[13px] text-dusk">
                    {member.email}
                    {member.position ? ` · ${member.position}` : ""}
                  </p>
                  <p className="mt-0.5 text-[12px] text-dusk">
                    {team.members.articles(member.articleCount)} · {team.members.joined(formatDate(member.joinedAt, locale))}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <TeamRoleSelect
                  id={`role-${member.id}`}
                  label={team.members.role(displayName(member))}
                  value={member.role}
                  disabled={member.isSelf || busy !== null}
                  onChange={(role) => changeRole(member, role)}
                  className="w-40"
                />
                <button type="button" className={`${ADMIN_SECONDARY} h-10 px-3`} onClick={() => setEditing(member)} disabled={busy !== null} aria-label={`${team.members.edit}: ${displayName(member)}`}>
                  <IconEdit size={15} />
                  <span className="hidden sm:inline">{team.members.edit}</span>
                </button>
                {!member.isSelf && (
                  <button type="button" className={`${ADMIN_SECONDARY} h-10 px-3 ${member.isBlocked ? "" : "hover:border-danger/40 hover:text-danger"}`} onClick={() => toggleBlock(member)} disabled={busy !== null} data-block-toggle={member.email}>
                    {busy === `block-${member.id}` && <Spinner size={14} />}
                    {member.isBlocked ? team.members.activate : team.members.deactivate}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="team-invites-title" className={ADMIN_CARD} data-testid="team-invites">
        <h3 id="team-invites-title" className="font-display text-[16px] font-bold text-ink">
          {team.invites.title}
        </h3>
        {data.invites.length === 0 ? (
          <p className="mt-2 text-sm text-dusk">{team.invites.empty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.invites.map((invite) => (
              <li key={invite.id} data-invite={invite.email} className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    <span className="truncate">{invite.email}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-dusk">{roles[invite.role]}</span>
                    {invite.expired && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">{team.invites.expired}</span>}
                  </p>
                  <p className="text-[12.5px] text-dusk">
                    {invite.expired ? null : `${team.invites.expires(formatDate(invite.expiresAt, locale))} · `}
                    {invite.invitedBy ? team.invites.invitedBy(invite.invitedBy) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${ADMIN_SECONDARY} h-9 px-3 text-[13px]`}
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(team.confirm.revoke(invite.email))) return;
                    void run(`invite-${invite.id}`, () => revokeTeamInvite(token, invite.id), team.done.revoked);
                  }}
                >
                  {busy === `invite-${invite.id}` && <Spinner size={14} />}
                  {team.invites.revoke}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <ProfileDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSave={async (fullName, position) => {
            await run(`profile-${editing.id}`, () => updateTeamMember(token, editing.id, { fullName, position: position || null }), team.done.profile);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProfileDialog({ member, onClose, onSave }: { member: TeamMember; onClose: () => void; onSave: (fullName: string, position: string) => Promise<void> }) {
  const p = useT().contentAdmin.team.profile;
  const panelRef = useRef<HTMLDivElement>(null);
  const [fullName, setFullName] = useState(member.name ?? "");
  const [position, setPosition] = useState(member.position ?? "");
  const [saving, setSaving] = useState(false);
  useDialog(true, panelRef, onClose);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" tabIndex={-1} className="w-full max-w-md animate-sheet-in rounded-t-3xl border border-line bg-surface p-5 shadow-pop focus:outline-none sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-dialog-title" className="font-display text-lg font-bold text-ink">
            {p.title}
          </h2>
          <button type="button" onClick={onClose} aria-label={p.cancel} className="flex h-9 w-9 items-center justify-center rounded-lg text-dusk hover:bg-surface-2 hover:text-ink">
            <IconX size={17} />
          </button>
        </div>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (fullName.trim().length < 2) return;
            setSaving(true);
            await onSave(fullName.trim(), position.trim());
            setSaving(false);
          }}
        >
          <div>
            <label htmlFor="profile-full-name" className={ADMIN_LABEL}>
              {p.fullName}
            </label>
            <input id="profile-full-name" data-autofocus value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={80} required className={`${ADMIN_INPUT} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="profile-position" className={ADMIN_LABEL}>
              {p.position}
            </label>
            <input id="profile-position" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={80} className={`${ADMIN_INPUT} mt-1.5`} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={ADMIN_SECONDARY} onClick={onClose}>
              {p.cancel}
            </button>
            <button type="submit" className={ADMIN_PRIMARY} disabled={saving || fullName.trim().length < 2}>
              {saving && <Spinner size={14} />}
              {p.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
