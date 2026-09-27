import React, { useState } from "react";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { createTeamInvite } from "../../../lib/admin/team.js";
import type { TeamRole } from "../../../lib/admin/roles.js";
import { errorText } from "../../../lib/admin/useNotice.js";
import { useShare } from "../../../lib/useShare.js";
import { ADMIN_CARD, ADMIN_INPUT, ADMIN_LABEL, ADMIN_PRIMARY, ADMIN_SECONDARY } from "../AdminStates.js";
import { IconCheck, IconCopy, IconUserPlus, Spinner } from "../icons.js";
import { TeamRoleSelect } from "./TeamRoleSelect.js";

/**
 * Taklif: email + rol. Havola serverdan bir marta keladi — shu yerda ko'rsatiladi
 * va nusxalanadi (SMTP sozlangan bo'lsa emailga ham yuboriladi). Ochiq
 * ro'yxatdan o'tish yo'q.
 */
export function TeamInvite({ token, onCreated }: { token: string; onCreated: () => void }) {
  const t = useT();
  const inv = t.contentAdmin.team.invite;
  const { locale } = useLocale();
  const { copy, notice } = useShare();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("content_author");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(t.contentAdmin.team.failed);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await createTeamInvite(token, { email: value, role });
      setResult({ email: res.invite.email, link: res.link, emailSent: res.emailSent });
      setEmail("");
      onCreated();
    } catch (err) {
      setError(errorText(err, t.contentAdmin.team.failed, locale));
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="team-invite-title" className={ADMIN_CARD} data-testid="team-invite">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal dark:text-indigo-300">
          <IconUserPlus size={19} />
        </span>
        <div className="min-w-0">
          <h3 id="team-invite-title" className="font-display text-[16px] font-bold text-ink">
            {inv.title}
          </h3>
          <p className="mt-0.5 text-sm text-dusk">{inv.text}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
        <div>
          <label htmlFor="invite-email" className={ADMIN_LABEL}>
            {inv.email}
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={inv.emailPlaceholder}
            autoComplete="off"
            required
            maxLength={160}
            className={`${ADMIN_INPUT} mt-1.5 h-10 py-0`}
          />
        </div>
        <TeamRoleSelect id="invite-role" label={inv.role} value={role} onChange={setRole} visibleLabel />
        <button type="submit" className={ADMIN_PRIMARY} disabled={sending}>
          {sending && <Spinner size={15} />}
          {sending ? inv.sending : inv.submit}
        </button>
      </form>
      <p className="mt-2 text-xs text-dusk">{inv.roleHints[role]}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="mt-4 rounded-xl border border-growth/30 bg-growth/10 p-4" data-testid="invite-result">
          <p className="flex items-center gap-2 text-sm font-semibold text-growth">
            <IconCheck size={16} />
            {inv.created(result.email)}
          </p>
          <label htmlFor="invite-link" className="mt-3 block text-xs font-semibold text-ink">
            {inv.link}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input id="invite-link" readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} className={`${ADMIN_INPUT} h-10 py-0 font-mono text-xs`} />
            <button type="button" className={`${ADMIN_SECONDARY} shrink-0`} onClick={() => void copy(result.link)}>
              <IconCopy size={15} />
              {notice === "copied" ? inv.copied : inv.copy}
            </button>
          </div>
          <p className="mt-2 text-xs text-dusk">{result.emailSent ? inv.emailSent : inv.emailNotSent}</p>
        </div>
      )}
    </section>
  );
}
