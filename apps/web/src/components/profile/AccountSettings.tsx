import React from "react";
import { useT, useHref } from "../../lib/i18n/index.js";
import type { Profile } from "../../lib/types.js";
import { useAuth } from "../AuthContext.js";
import { LanguageSwitcher } from "../LanguageSwitcher.js";
import { ThemeToggle } from "../ThemeToggle.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { Button, Card, SectionHeader, TabLink, buttonClass } from "./ui.js";
import {
  IconAlert,
  IconArrowRight,
  IconBell,
  IconGlobe,
  IconHelp,
  IconLock,
  IconLogout,
  IconMail,
  IconMoon,
  IconPhone,
  IconSettings,
  IconShield,
  IconTrash,
} from "./icons.js";

/**
 * Hisob sozlamalari.
 *
 * Parol Telegram orqali tiklanadi (audit R3, D-045): qator `/login?recover=1`
 * oqimiga olib boradi. Hisobni o'chirish API'si hali yo'q — u yordam markaziga
 * yo'naltiradi (ishlamaydigan tugma emas).
 */
export function AccountSettings({ profile, email }: { profile: Profile | null; email: string }) {
  const t = useT();
  const l = useHref();
  const nav = useProfileNav();
  const { logout } = useAuth();
  const s = t.profileHub.settings;
  const verified = Boolean(profile?.isPhoneVerified);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-7">
        <SectionHeader as="h1" title={t.profileHub.nav.settings} subtitle={s.subtitle} icon={<IconSettings size={19} />} />
      </Card>

      <SettingsGroup title={s.account}>
        <SettingRow icon={<IconMail size={18} />} title={t.profile.email} description={s.emailHint}>
          <span className="inline-flex max-w-full items-center gap-2 truncate rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] font-medium text-ink">
            <IconLock size={14} className="shrink-0 text-dusk" />
            <span className="truncate">{email}</span>
          </span>
        </SettingRow>
        <SettingRow
          icon={<IconPhone size={18} />}
          title={s.phoneStatus}
          description={verified ? profile?.phone ?? "" : t.telegram.phoneNotVerified}
        >
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-growth/10 px-3 py-1.5 text-[13px] font-semibold text-growth">
              <IconShield size={14} /> {t.profile.phoneVerified}
            </span>
          ) : (
            <TabLink href={nav.href("telegram")} onNavigate={() => nav.go("telegram")} className={buttonClass("secondary", "sm")}>
              {s.verify} <IconArrowRight size={14} />
            </TabLink>
          )}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={s.preferences}>
        <SettingRow icon={<IconGlobe size={18} />} title={s.language} description={s.languageHint}>
          <div className="rounded-xl border border-line bg-surface">
            <LanguageSwitcher />
          </div>
        </SettingRow>
        <SettingRow icon={<IconMoon size={18} />} title={s.theme} description={s.themeHint}>
          <div className="rounded-xl border border-line bg-surface">
            <ThemeToggle />
          </div>
        </SettingRow>
        <SettingRow icon={<IconBell size={18} />} title={s.notifications} description={s.notificationsHint}>
          <a href={l("/notifications?tab=settings")} className={buttonClass("secondary", "sm")}>
            {s.manage} <IconArrowRight size={14} />
          </a>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={s.security}>
        <SettingRow icon={<IconLock size={18} />} title={s.password} description={s.passwordHint}>
          <a href={l("/login?recover=1")} className={buttonClass("secondary", "sm")}>
            <IconShield size={15} /> {s.resetPassword}
          </a>
        </SettingRow>
        <SettingRow icon={<IconLogout size={18} />} title={s.logout} description={s.logoutHint}>
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            <IconLogout size={15} /> {t.nav.logout}
          </Button>
        </SettingRow>
      </SettingsGroup>

      <section
        aria-labelledby="danger-zone"
        className="rounded-3xl border border-danger/25 bg-danger/[0.03] p-5 sm:p-6"
      >
        <h2 id="danger-zone" className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-danger">
          <IconAlert size={14} /> {s.danger}
        </h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger" aria-hidden>
              <IconTrash size={18} />
            </span>
            <div>
              <p className="text-[14.5px] font-semibold text-ink">{s.deleteAccount}</p>
              <p className="mt-0.5 max-w-lg text-[13px] leading-relaxed text-dusk">{s.deleteHint}</p>
            </div>
          </div>
          <a
            href={l("/support")}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-danger/30 px-3.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            <IconHelp size={15} /> {s.contactSupport}
          </a>
        </div>
      </section>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-2 sm:p-3">
      <h2 className="px-3 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dusk sm:px-4">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink/70" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-ink">{title}</p>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-dusk">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center pl-[54px] sm:pl-0">{children}</div>
    </div>
  );
}
