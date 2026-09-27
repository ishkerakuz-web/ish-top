import React, { useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { useAuth } from "../../AuthContext.js";
import { ApiError } from "../../../lib/api.js";
import { acceptStaffInvite, fetchStaffInvite } from "../../../lib/admin/team.js";
import type { TeamRole } from "../../../lib/admin/roles.js";
import { errorText } from "../../../lib/admin/useNotice.js";
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_PRIMARY, ADMIN_SECONDARY } from "../AdminStates.js";
import { IconAlert, IconEye, IconEyeOff, IconUserPlus, Spinner } from "../icons.js";

type InviteState =
  | { kind: "loading" }
  | { kind: "ready"; email: string; role: TeamRole }
  | { kind: "invalid" }
  | { kind: "used" }
  | { kind: "expired" }
  | { kind: "error" };

/**
 * `/admin/invite?token=…` — taklif havolasi orqali kontent jamoasi hisobini
 * yaratish. Email taklifdan (o'zgartirib bo'lmaydi), rol ham taklifdan. Boshqa
 * hisob bilan kirilgan bo'lsa — avval chiqish so'raladi (hisoblar aralashmasin).
 */
export function InviteAccept() {
  const t = useT();
  const inv = t.contentAdmin.invite;
  const l = useHref();
  const { locale } = useLocale();
  const pageContext = usePageContext();
  const token = String((pageContext.urlParsed?.search as Record<string, string> | undefined)?.token ?? "");
  const { status, user, login, logout } = useAuth();
  const [state, setState] = useState<InviteState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    const ctrl = new AbortController();
    setState({ kind: "loading" });
    fetchStaffInvite(token, ctrl.signal)
      .then((invite) => setState({ kind: "ready", email: invite.email, role: invite.role }))
      .catch((err: unknown) => {
        if ((err as Error)?.name === "AbortError") return;
        if (err instanceof ApiError && err.code === "INVITE_USED") setState({ kind: "used" });
        else if (err instanceof ApiError && err.code === "INVITE_EXPIRED") setState({ kind: "expired" });
        else if (err instanceof ApiError && err.status === 404) setState({ kind: "invalid" });
        else setState({ kind: "error" });
      });
    return () => ctrl.abort();
  }, [token, attempt]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2 || password.length < 8) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await acceptStaffInvite(token, { fullName: fullName.trim(), position: position.trim() || undefined, password });
      await login(res.accessToken);
      // Moderator maqolalarga emas, moderatsiya navbatiga tushadi
      window.location.assign(l(res.role === "moderator" ? "/admin/vacancies" : res.role === "admin" ? "/admin" : "/admin/articles"));
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVITE_USED") setState({ kind: "used" });
      else if (err instanceof ApiError && err.code === "INVITE_EXPIRED") setState({ kind: "expired" });
      else setFormError(errorText(err, inv.failed, locale));
      setSubmitting(false);
    }
  };

  const panel = (title: string, text: string, actions: React.ReactNode, tone: "neutral" | "danger" = "neutral") => (
    <div className="text-center" role={tone === "danger" ? "alert" : undefined} data-testid={`invite-${state.kind}`}>
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-signal-soft text-signal dark:text-indigo-300"}`}>
        <IconAlert size={22} />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-dusk">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">{actions}</div>
    </div>
  );
  const homeLink = (
    <a href={l("/")} className={ADMIN_SECONDARY}>
      {inv.home}
    </a>
  );

  let body: React.ReactNode;
  if (state.kind === "loading" || status === "loading") {
    body = (
      <div aria-busy="true" className="flex flex-col items-center py-10 text-dusk">
        <Spinner size={24} />
        <span role="status" className="mt-3 text-sm">
          {inv.loading}
        </span>
      </div>
    );
  } else if (state.kind === "invalid") {
    body = panel(inv.invalid.title, inv.invalid.text, homeLink, "danger");
  } else if (state.kind === "used") {
    body = panel(inv.used.title, inv.used.text, (
      <>
        <a href={l("/login")} className={ADMIN_PRIMARY}>
          {inv.used.login}
        </a>
        {homeLink}
      </>
    ));
  } else if (state.kind === "expired") {
    body = panel(inv.expired.title, inv.expired.text, homeLink, "danger");
  } else if (state.kind === "error") {
    body = panel(inv.failed, t.contentAdmin.team.error.text, (
      <button type="button" className={ADMIN_PRIMARY} onClick={() => setAttempt((n) => n + 1)}>
        {t.contentAdmin.team.error.retry}
      </button>
    ), "danger");
  } else if (status === "authed" && user) {
    body = panel(inv.signedIn.title, inv.signedIn.text(user.email), (
      <button type="button" className={ADMIN_PRIMARY} onClick={() => void logout()}>
        {inv.signedIn.logout}
      </button>
    ));
  } else {
    body = (
      <div data-testid="invite-form">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-soft text-signal dark:text-indigo-300">
          <IconUserPlus size={22} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{inv.title}</h1>
        <p className="mt-1.5 text-sm text-dusk">{inv.text(t.contentAdmin.roles[state.role])}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="invite-accept-email" className={ADMIN_LABEL}>
              {inv.email}
            </label>
            <input id="invite-accept-email" value={state.email} readOnly className={`${ADMIN_INPUT} mt-1.5 bg-surface-2 text-dusk`} />
          </div>
          <div>
            <label htmlFor="invite-accept-name" className={ADMIN_LABEL}>
              {inv.fullName}
            </label>
            <input id="invite-accept-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" className={`${ADMIN_INPUT} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="invite-accept-position" className={ADMIN_LABEL}>
              {inv.position}
            </label>
            <input id="invite-accept-position" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={80} aria-describedby="invite-accept-position-hint" className={`${ADMIN_INPUT} mt-1.5`} />
            <p id="invite-accept-position-hint" className="mt-1 text-xs text-dusk">
              {inv.positionHint}
            </p>
          </div>
          <div>
            <label htmlFor="invite-accept-password" className={ADMIN_LABEL}>
              {inv.password}
            </label>
            <div className="relative mt-1.5">
              <input
                id="invite-accept-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                aria-describedby="invite-accept-password-hint"
                className={`${ADMIN_INPUT} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? inv.hidePassword : inv.showPassword}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-dusk hover:bg-surface-2 hover:text-ink"
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            <p id="invite-accept-password-hint" className="mt-1 text-xs text-dusk">
              {inv.passwordHint}
            </p>
          </div>
          {formError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          )}
          <button type="submit" className={`${ADMIN_PRIMARY} h-11 w-full`} disabled={submitting || fullName.trim().length < 2 || password.length < 8}>
            {submitting && <Spinner size={15} />}
            {submitting ? inv.submitting : inv.submit}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">{body}</div>
    </div>
  );
}
