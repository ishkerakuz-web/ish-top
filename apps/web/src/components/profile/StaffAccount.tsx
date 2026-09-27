import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { fetchProfile } from "../../lib/api.js";
import type { CurrentUser, Profile } from "../../lib/types.js";
import { isStaffRole } from "../../lib/admin/roles.js";
import { Skeleton } from "../Skeleton.js";
import { TelegramConnect } from "../TelegramConnect.js";
import { ProfileNavProvider } from "./ProfileNavContext.js";
import { AccountSettings } from "./AccountSettings.js";
import { Card, ErrorState, buttonClass } from "./ui.js";

/**
 * Admin va kontent jamoasi uchun HISOB sahifasi (audit: profile-1).
 *
 * `/profile` nomzodning karyera markazi, ish beruvchiniki esa kompaniya profili.
 * Admin uchun ikkalasi ham to'g'ri kelmaydi — ilgari u nomzod sahifasini olardi va
 * nomzodga xos so'rovlar 403 bilan qaytib, sahifa "Ma'lumotlarni yuklab bo'lmadi"
 * holatida qolardi. Endi bu yerda faqat hisobga tegishli narsa bor: kim ekani,
 * telefon tasdig'i va umumiy sozlamalar.
 */
export function StaffAccount({ token, user }: { token: string; user: CurrentUser }) {
  const t = useT();
  const l = useHref();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const telegramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchProfile(token).then(
      (data) => {
        if (cancelled) return;
        setProfile(data);
        setState(data ? "ready" : "error");
      },
      () => {
        if (!cancelled) setState("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  // Sozlamalardagi "tasdiqlash" havolasi shu sahifadagi Telegram kartasiga olib boradi
  const goToTelegram = useCallback(() => {
    telegramRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Telefon tasdiqlangach holat (sozlamalardagi belgi) darhol yangilansin
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7" aria-busy="true">
        <Skeleton className="h-[132px] rounded-3xl" />
        <Skeleton className="mt-5 h-[220px] rounded-3xl" />
        <Skeleton className="mt-5 h-[320px] rounded-3xl" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card className="p-6">
          <ErrorState onRetry={refresh} />
        </Card>
      </div>
    );
  }

  const email = profile?.email ?? user.email;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const roleLabel =
    user.role === "admin"
      ? t.contentAdmin.roles.admin
      : isStaffRole(user.role) || user.role === "moderator"
        ? t.contentAdmin.roles[user.role as "content_editor" | "content_author" | "moderator"]
        : t.profileHub.staff.title;

  return (
    <ProfileNavProvider go={goToTelegram}>
      <div className="mx-auto max-w-3xl px-4 pb-14 pt-5 sm:px-6 sm:pt-7">
        <Card className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-[20px] font-bold text-accent"
                aria-hidden
              >
                {(name || email).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[21px] font-bold tracking-tight text-ink sm:text-[24px]">
                  {name || t.profileHub.staff.title}
                </h1>
                <p className="mt-0.5 truncate text-[13.5px] text-dusk">{email}</p>
                <p className="mt-2 inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink/80">
                  {t.profileHub.staff.role}: {roleLabel}
                </p>
              </div>
            </div>
            <a href={l("/admin")} className={`${buttonClass("secondary", "sm")} shrink-0`}>
              {t.navExtra.admin}
            </a>
          </div>
          <p className="mt-5 text-[13.5px] leading-relaxed text-dusk">{t.profileHub.staff.subtitle}</p>
        </Card>

        <div ref={telegramRef} className="mt-5 scroll-mt-28">
          <TelegramConnect variant="panel" onStatusChange={refresh} />
        </div>

        <div className="mt-5">
          <AccountSettings profile={profile} email={email} />
        </div>
      </div>
    </ProfileNavProvider>
  );
}
