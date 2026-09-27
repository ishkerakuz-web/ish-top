import React, { useId, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { loginUser, ApiError } from "../../lib/api.js";
import { useAuth } from "../../components/AuthContext.js";
import { AuthShell } from "../../components/AuthShell.js";
import {
  AuthTabs,
  AuthField,
  AuthError,
  PasswordField,
  AuthSubmit,
  MailIcon,
} from "../../components/AuthForm.js";
import { SocialLogin } from "../../components/SocialLogin.js";
import { RecoveryPanel } from "../../components/auth/RecoveryPanel.js";
import { recoveryModeFrom, type RecoveryMode } from "../../lib/auth/recovery.js";
import { useT, useHref } from "../../lib/i18n/index.js";
import { returnTargetOr } from "../../lib/auth/returnTo.js";

export default function Page() {
  const pageContext = usePageContext();
  const search = (pageContext.urlParsed?.search ?? {}) as Record<string, string | undefined>;
  // Rejim va reset tokeni URL'dan olinadi. `history.replaceState` bilan token
  // manzil qatoridan olib tashlanganda `pageContext` o'zgarmaydi — shuning uchun
  // forma joyida qoladi, sahifalar orasida o'tishda esa rejim yangilanadi (audit R3, D-063).
  const mode: RecoveryMode = recoveryModeFrom(search);
  const resetToken = search.reset ?? "";

  if (mode) {
    return (
      <AuthShell active="login">
        <RecoveryPanel mode={mode} resetToken={resetToken} />
      </AuthShell>
    );
  }

  return (
    <AuthShell active="login">
      <LoginForm returnTo={search.returnTo ?? null} />
    </AuthShell>
  );
}

function LoginForm({ returnTo }: { returnTo: string | null }) {
  const { login } = useAuth();
  const t = useT();
  const l = useHref();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Ro'yxatdan o'tishga o'tganda ham qaytish manzili saqlanadi (audit R3, auth-core-17).
  // Manzil URL'dan (SSR va brauzerda bir xil) olinadi, xavfsizligi signup sahifasida tekshiriladi.
  const signupHref = returnTo
    ? `${l("/signup")}?returnTo=${encodeURIComponent(returnTo)}`
    : l("/signup");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await loginUser({ email, password });
      await login(accessToken);
      // Kirishdan oldingi sahifaga qaytiladi (faqat sayt ichidagi yo'l; audit ISSUE-066)
      window.location.assign(returnTargetOr(l("/")));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.login.connError);
      // Xato e'lon qilinadi va fokus birinchi maydonga qaytadi (audit R3, a11y-ui-3)
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-[1.85rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2rem]">
        {t.login.title} <span className="text-shine">{t.login.titleAccent}</span>
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-dusk">{t.login.subtitle}</p>

      <div className="mt-5">
        <AuthTabs active="login" />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <AuthField
          label={t.login.identifier}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t.login.identifierPlaceholder}
          autoComplete="username"
          required
          icon={<MailIcon />}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          inputRef={emailRef}
        />
        <PasswordField
          label={t.login.password}
          value={password}
          onChange={setPassword}
          placeholder={t.login.passwordPlaceholder}
          autoComplete="current-password"
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
        />

        {/* «Meni eslab qolish» olib tashlandi: server har doim 30 kunlik refresh
            cookie beradi — ishlamaydigan xavfsizlik nazorati (audit R3, auth-core-16) */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <a
            href={l("/login?recover=1")}
            className="text-[13.5px] font-semibold text-signal transition-colors hover:text-signal-dark"
          >
            {t.login.forgot}
          </a>
        </div>

        {error && <AuthError id={errorId}>{error}</AuthError>}

        <AuthSubmit loading={loading} label={t.login.submit} loadingLabel={t.login.submitting} />
      </form>

      <SocialLogin onDone={() => window.location.assign(returnTargetOr(l("/")))} />

      <p className="mt-4 text-center text-[13.5px] text-dusk">
        {t.login.noAccount}{" "}
        <a
          href={signupHref}
          className="group inline-flex items-center gap-1 font-bold text-signal transition-colors hover:text-signal-dark"
        >
          {t.login.signupLink}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </p>
    </>
  );
}
