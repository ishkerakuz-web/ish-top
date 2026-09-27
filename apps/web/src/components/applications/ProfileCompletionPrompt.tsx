import React from "react";
import type { ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import { useHref, useT } from "../../lib/i18n/index.js";
import { Skeleton } from "../Skeleton.js";
import { IconArrowRight, IconUser } from "./icons.js";

/**
 * "Faol bo'ling!" — profil to'liq bo'lmaganda o'ng panel tepasida.
 * Qat'iy qoida: 100% bo'lsa yoki foiz aniqlanmasa (profil yuklanmadi) `null` —
 * na karta, na bo'sh joy; panel tabiiy ravishda yuqoriga ko'tariladi.
 * Foiz aniqlanguncha — skelet (0% deb taxmin qilinmaydi).
 */
export function ProfileCompletionPrompt({ state }: { state: ProfileCompletionState }) {
  const p = useT().applicationsPage.prompt;
  const l = useHref();

  if (state.status === "error") return null;
  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="rounded-3xl border border-line bg-surface p-5">
        <span role="status" className="sr-only">
          {p.loading}
        </span>
        <div className="flex gap-3.5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3.5 w-full" />
          </div>
        </div>
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
        <Skeleton className="mt-4 h-10 w-44 rounded-xl" />
      </div>
    );
  }
  if (state.percent >= 100) return null;

  const level = state.percent < 50 ? p.levels.low : state.percent < 80 ? p.levels.mid : p.levels.high;

  return (
    <section
      aria-labelledby="profile-prompt-title"
      data-testid="profile-prompt"
      className="rounded-3xl border border-signal/20 bg-signal-soft p-5 shadow-card"
    >
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-signal shadow-xs ring-1 ring-signal/15">
          <IconUser size={20} />
        </span>
        <div className="min-w-0">
          <h2 id="profile-prompt-title" className="font-display text-[16px] font-bold leading-snug tracking-tight text-ink">
            {p.title}
          </h2>
          <p className="mt-1 text-[13.5px] leading-snug text-dusk">{p.text}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="font-semibold text-ink">{level}</span>
          <span className="font-display text-[15px] font-bold tabular-nums text-signal">{state.percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.percent}
          aria-label={p.progress(state.percent)}
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-line"
        >
          <div className="h-full rounded-full bg-signal" style={{ width: `${state.percent}%` }} />
        </div>
      </div>

      <a
        href={l("/profile")}
        className="group mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl border border-signal/40 bg-surface px-4 text-[13.5px] font-semibold text-signal transition-colors hover:border-signal hover:bg-signal hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {p.cta}
        <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  );
}
