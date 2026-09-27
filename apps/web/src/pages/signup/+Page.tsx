import React, { useId, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { registerUser, ApiError } from "../../lib/api.js";
import { useAuth } from "../../components/AuthContext.js";
import { AuthShell } from "../../components/AuthShell.js";
import {
  AuthTabs,
  AuthField,
  AuthError,
  PasswordField,
  AuthSubmit,
  MailIcon,
  UserIcon,
  BuildingIcon,
} from "../../components/AuthForm.js";
import { SocialLogin } from "../../components/SocialLogin.js";
import { returnTargetOr } from "../../lib/auth/returnTo.js";
import { useT, useHref } from "../../lib/i18n/index.js";

export default function Page() {
  const { login } = useAuth();
  const t = useT();
  const l = useHref();
  const pageContext = usePageContext();
  const initialRole =
    (pageContext.urlParsed?.search?.role as string) === "employer" ? "employer" : "job_seeker";
  const [role, setRole] = useState<"job_seeker" | "employer">(initialRole);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  // Ro'yxatdan o'tgach avvalgi sahifaga qaytiladi (audit R3, auth-core-17)
  const done = () => window.location.assign(returnTargetOr(l(role === "employer" ? "/employer" : "/profile")));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await registerUser({
        email,
        password,
        role,
        firstName: role === "job_seeker" ? firstName : undefined,
        lastName: role === "job_seeker" ? lastName : undefined,
        companyName: role === "employer" ? companyName : undefined,
      });
      await login(accessToken);
      done();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.signup.connError);
      // Xato e'lon qilinadi va fokus email maydoniga qaytadi (audit R3, a11y-ui-3)
      emailRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell active="signup">
      <h1 className="font-display text-[1.85rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2rem]">
        {t.signup.title} <span className="text-shine">{t.signup.titleAccent}</span>
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-dusk">{t.signup.subtitle}</p>

      <div className="mt-5">
        <AuthTabs active="signup" />
      </div>

      {/* Kim sifatida ro'yxatdan o'tish — formaning qolgan qismini belgilaydi */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <RoleCard
          active={role === "job_seeker"}
          onClick={() => setRole("job_seeker")}
          label={t.signup.roleSeeker}
          icon={<UserIcon />}
        />
        <RoleCard
          active={role === "employer"}
          onClick={() => setRole("employer")}
          label={t.signup.roleEmployer}
          icon={<BuildingIcon />}
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        {role === "job_seeker" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <AuthField
              label={t.signup.firstName}
              value={firstName}
              onChange={setFirstName}
              autoComplete="given-name"
              icon={<UserIcon />}
            />
            <AuthField
              label={t.signup.lastName}
              value={lastName}
              onChange={setLastName}
              autoComplete="family-name"
              icon={<UserIcon />}
            />
          </div>
        ) : (
          <AuthField
            label={t.signup.companyName}
            value={companyName}
            onChange={setCompanyName}
            placeholder={t.signup.companyNamePlaceholder}
            autoComplete="organization"
            required
            icon={<BuildingIcon />}
          />
        )}

        <AuthField
          label={t.signup.email}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ism@email.com"
          autoComplete="email"
          required
          icon={<MailIcon />}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          inputRef={emailRef}
        />
        <PasswordField
          label={t.signup.password}
          value={password}
          onChange={setPassword}
          placeholder={t.signup.passwordHint}
          autoComplete="new-password"
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
        />

        {error && <AuthError id={errorId}>{error}</AuthError>}

        <AuthSubmit loading={loading} label={t.signup.submit} loadingLabel={t.signup.submitting} />
      </form>

      <SocialLogin role={role} onDone={done} />

      <p className="mt-4 text-center text-[13.5px] text-dusk">
        {t.signup.haveAccount}{" "}
        <a
          href={l("/login")}
          className="group inline-flex items-center gap-1 font-bold text-signal transition-colors hover:text-signal-dark"
        >
          {t.signup.loginLink}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </p>
    </AuthShell>
  );
}

/** Rol tanlash kartasi — ikonka + nom, tanlanganida indigo ramka. */
function RoleCard({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13.5px] font-semibold transition-all ${
        active
          ? "border-signal bg-signal-soft text-signal"
          : "border-line bg-surface text-dusk hover:border-signal/40 hover:text-ink"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-signal" : "text-dusk"}`}>{icon}</span>
      <span className="whitespace-nowrap leading-tight">{label}</span>
    </button>
  );
}
