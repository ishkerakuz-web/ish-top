import React, { createContext, useContext, useMemo } from "react";
import { useHref } from "../../lib/i18n/index.js";
import { profileTabHref, type ProfileTab } from "../../lib/profile/tabs.js";

interface ProfileNavValue {
  go: (tab: ProfileTab, step?: number) => void;
  /** Bo'limning to'liq manzili (til prefiksi bilan) — `<a href>` uchun. */
  href: (tab: ProfileTab, step?: number) => string;
}

const ProfileNavCtx = createContext<ProfileNavValue | null>(null);

export function ProfileNavProvider({
  go,
  children,
}: {
  go: (tab: ProfileTab, step?: number) => void;
  children: React.ReactNode;
}) {
  const l = useHref();
  const base = l("/profile");
  // Arizalar alohida sahifada (`/applications`) — profil ichidagi havolalar shu yerga olib boradi
  const applications = l("/applications");
  const value = useMemo<ProfileNavValue>(
    () => ({
      go: (tab, step) => {
        if (tab === "applications") window.location.assign(applications);
        else go(tab, step);
      },
      href: (tab, step) => (tab === "applications" ? applications : profileTabHref(base, tab, step)),
    }),
    [go, base, applications]
  );
  return <ProfileNavCtx.Provider value={value}>{children}</ProfileNavCtx.Provider>;
}

export function useProfileNav(): ProfileNavValue {
  const ctx = useContext(ProfileNavCtx);
  if (!ctx) throw new Error("useProfileNav faqat ProfileNavProvider ichida ishlatiladi");
  return ctx;
}
