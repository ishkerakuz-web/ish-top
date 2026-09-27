import React, { useEffect, useRef, useState } from "react";
import { loginWithGoogle, ApiError } from "../lib/api.js";
import { useAuth } from "./AuthContext.js";
import { useT } from "../lib/i18n/index.js";
import { AuthDivider } from "./AuthForm.js";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Ijtimoiy kirish bloki: Google (GIS) va hozircha ulanmagan Apple tugmasi.
 *
 * Telegram kirish kanali emas (audit R3, D-041): tugma va polling olib tashlandi —
 * Telegram faqat telefon tasdiqlash va parolni tiklash uchun ishlatiladi.
 *
 * Google: login sahifasida hisob topilmasa NEED_SIGNUP xatosi keladi;
 * signup sahifasida `role` berilgani uchun hisob darrov yaratiladi.
 */
export function SocialLogin({
  role,
  onDone,
}: {
  role?: "job_seeker" | "employer";
  onDone: () => void;
}) {
  const t = useT();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [soon, setSoon] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);

  // Google GIS skriptini faqat shu sahifada, async yuklaymiz (performance'ga zarar yo'q)
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleRef.current) return;

    const renderButton = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError(null);
          try {
            const { accessToken } = await loginWithGoogle(credential, role);
            await login(accessToken);
            onDone();
          } catch (err) {
            // Qattiq yozilgan o'zbekcha matn emas — joriy til lug'atidan (audit R3, i18n-9)
            setError(err instanceof ApiError ? err.message : t.login.connError);
          }
        },
      });
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: "outline",
        size: "large",
        width: 300,
        text: "continue_with",
      });
    };

    if (window.google) {
      renderButton();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = renderButton;
    document.head.appendChild(script);
  }, [role]);

  return (
    <div>
      <AuthDivider />

      {/* Ikkala usul bitta qatorda. Yorliq qisqa (provayder nomi), to'liq ma'no
          `aria-label` da: "Google orqali kirish".
          Google: VITE_GOOGLE_CLIENT_ID berilganda haqiqiy GIS tugmasi
          chiziladi; berilmasa (va Apple har doim) tugma bosilganda
          "hozircha ulanmagan" izohi chiqadi — jim turgan tugmadan yaxshiroq. */}
      <div className="grid grid-cols-2 gap-2.5">
        {GOOGLE_CLIENT_ID ? (
          <div ref={googleRef} className="flex justify-center [color-scheme:light]" />
        ) : (
          <ProviderButton
            icon={<GoogleIcon />}
            label="Google"
            title={t.login.withGoogle}
            onClick={() => setSoon(true)}
          />
        )}
        <ProviderButton
          icon={<AppleIcon />}
          label="Apple"
          title={t.login.withApple}
          onClick={() => setSoon(true)}
        />
      </div>

      {soon && <Note>{t.login.socialSoon}</Note>}
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          <span className="sr-only">{t.login.errorLabel}: </span>
          {error}
        </p>
      )}
    </div>
  );
}

/** Ijtimoiy kirish tugmasi — bir xil balandlik va ikonka joylashuvi. */
function ProviderButton({
  icon,
  label,
  title,
  onClick,
  disabled = false,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-2 text-[13.5px] font-semibold text-ink transition-all hover:border-signal/40 hover:shadow-card-hover active:scale-[0.99] disabled:opacity-70 ${className}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="animate-fade-in mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-dusk" role="status">
      {children}
    </p>
  );
}

/** Google'ning to'rt rangli "G" belgisi (rasmiy SVG geometriyasi). */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.7Z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.8-1.7 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-3.9ZM14 5.2c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3Z" />
    </svg>
  );
}
