import React from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { regionDisplayName } from "../../lib/format.js";
import type { Profile } from "../../lib/types.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { Card, ProgressBar, TabLink, buttonClass } from "./ui.js";
import { IconEye, IconPencil, IconPin, IconShield } from "./icons.js";

/** Ism-familiyadan 1–2 harfli bosh harflar; bo'lmasa email'ning birinchi harfi. */
function initialsOf(profile: Profile | null, email: string): string {
  const letters = [profile?.firstName, profile?.lastName]
    .map((part) => part?.trim().charAt(0) ?? "")
    .join("");
  return (letters || email.charAt(0) || "?").toUpperCase();
}

export function ProfileHeader({
  profile,
  email,
  completion,
}: {
  profile: Profile | null;
  email: string;
  completion: { percent: number };
}) {
  const t = useT();
  const { locale } = useLocale();
  const nav = useProfileNav();
  const h = t.profileHub.header;
  const fullName = [profile?.firstName, profile?.lastName].filter((x) => x?.trim()).join(" ");
  const verified = Boolean(profile?.isPhoneVerified);
  const openToWork = profile?.isOpenToWork ?? true;
  const complete = completion.percent >= 100;

  return (
    <Card as="section" className="relative overflow-hidden" aria-labelledby="profile-hub-name">
      {/* Juda yengil rang dog'i — dashboard'ga "mahsulot" hissi, marketing banner emas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(80%_140%_at_0%_0%,rgb(99_102_241/0.10),transparent_62%),radial-gradient(60%_120%_at_100%_0%,rgb(139_92_246/0.07),transparent_60%)]"
      />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <span
                aria-hidden
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-signal to-[#8B5CF6] font-display text-xl font-extrabold tracking-tight text-white shadow-card ring-4 ring-surface sm:h-[76px] sm:w-[76px] sm:text-2xl"
              >
                {initialsOf(profile, email)}
              </span>
              {verified && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-growth text-white ring-[3px] ring-surface"
                  title={h.phoneVerified}
                >
                  <IconShield size={13} />
                  <span className="sr-only">{h.phoneVerified}</span>
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1
                id="profile-hub-name"
                className={`truncate font-display text-[22px] font-extrabold leading-tight tracking-tight sm:text-[27px] ${
                  fullName ? "text-ink" : "text-dusk"
                }`}
              >
                {fullName || h.nameMissing}
              </h1>
              <p className={`mt-1 truncate text-[15px] font-medium ${profile?.headline ? "text-ink/80" : "text-dusk"}`}>
                {profile?.headline || h.headlineMissing}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-dusk">
                <span className="inline-flex items-center gap-1.5">
                  <IconPin size={15} />
                  {/* Audit R3, i18n-4 */ regionDisplayName(locale, profile?.regionName) || h.regionMissing}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    openToWork ? "bg-growth/10 text-growth" : "bg-surface-2 text-dusk"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${openToWork ? "bg-growth" : "bg-dusk/50"}`} aria-hidden />
                  {openToWork ? h.openToWork : h.notOpenToWork}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap md:shrink-0">
            <TabLink
              href={nav.href("resume", 6)}
              onNavigate={() => nav.go("resume", 6)}
              className={`${buttonClass("secondary")} px-4`}
            >
              <IconEye size={17} />
              <span className="truncate">{h.viewResume}</span>
            </TabLink>
            <TabLink
              href={nav.href("personal")}
              onNavigate={() => nav.go("personal")}
              className={`${buttonClass("primary")} px-4`}
            >
              <IconPencil size={16} />
              <span className="truncate">{h.editProfile}</span>
            </TabLink>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/50 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
          <div className="sm:w-72 sm:shrink-0">
            <p className="text-[13px] font-semibold text-ink">{h.completion}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-dusk">{complete ? h.completionDone : h.completionHint}</p>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <ProgressBar value={completion.percent} label={h.completion} />
            <span
              className={`w-11 shrink-0 text-right font-display text-[15px] font-extrabold tabular-nums ${
                complete ? "text-growth" : "text-signal"
              }`}
            >
              {completion.percent}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
