import React, { useEffect, useRef } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ProfileTab } from "../../lib/profile/tabs.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { TabLink } from "./ui.js";
import {
  IconBriefcase,
  IconCap,
  IconFile,
  IconGrid,
  IconHeart,
  IconSend,
  IconSettings,
  IconSpark,
  IconTelegram,
  IconUser,
} from "./icons.js";

const GROUPS: { tab: ProfileTab; Icon: (p: { size?: number }) => React.ReactElement }[][] = [
  [
    { tab: "overview", Icon: IconGrid },
    { tab: "personal", Icon: IconUser },
    { tab: "resume", Icon: IconFile },
    { tab: "experience", Icon: IconBriefcase },
    { tab: "education", Icon: IconCap },
    { tab: "skills", Icon: IconSpark },
  ],
  [
    { tab: "applications", Icon: IconSend },
    { tab: "saved", Icon: IconHeart },
  ],
  [
    { tab: "telegram", Icon: IconTelegram },
    { tab: "settings", Icon: IconSettings },
  ],
];

/**
 * Profil ichki navigatsiyasi.
 * - Desktop (lg+): yopishqoq yon panel, guruhlar ingichka chiziq bilan ajratilgan.
 * - Planshet/mobil: header ostida yopishqoq, gorizontal aylanadigan qator;
 *   faol element avtomatik ko'rinish markaziga suriladi.
 * `attention` — to'ldirilmagan bo'limlar yonida logotip sarig'idagi nuqta.
 */
export function ProfileNav({
  active,
  counts,
  attention,
}: {
  active: ProfileTab;
  counts: Partial<Record<ProfileTab, number>>;
  attention: Partial<Record<ProfileTab, boolean>>;
}) {
  const t = useT();
  const nav = useProfileNav();
  const labels = t.profileHub.nav;
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !el) return;
    const left = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  return (
    <>
      {/* Desktop — yon panel */}
      <nav aria-label={t.profileHub.navLabel} className="hidden lg:block">
        <div className="sticky top-24 rounded-3xl border border-line bg-surface p-2 shadow-card">
          {GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="mx-3 my-2 h-px bg-line" aria-hidden />}
              <ul className="flex flex-col gap-0.5">
                {group.map(({ tab, Icon }) => {
                  const isActive = tab === active;
                  const count = counts[tab];
                  return (
                    <li key={tab}>
                      <TabLink
                        href={nav.href(tab)}
                        onNavigate={() => nav.go(tab)}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[14px] transition-colors ${
                          isActive
                            ? "bg-signal-soft font-semibold text-signal"
                            : "font-medium text-ink/75 hover:bg-surface-2 hover:text-ink"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-signal" aria-hidden />
                        )}
                        <span className={isActive ? "text-signal" : "text-dusk transition-colors group-hover:text-ink"}>
                          <Icon size={18} />
                        </span>
                        <span className="flex-1 truncate">{labels[tab]}</span>
                        {typeof count === "number" && count > 0 ? (
                          <span
                            className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums ${
                              isActive ? "bg-signal text-white" : "bg-surface-2 text-dusk"
                            }`}
                          >
                            {count}
                          </span>
                        ) : attention[tab] ? (
                          <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
                        ) : null}
                      </TabLink>
                    </li>
                  );
                })}
              </ul>
            </React.Fragment>
          ))}
        </div>
      </nav>

      {/* Planshet va mobil — gorizontal qator */}
      <nav
        aria-label={t.profileHub.navLabel}
        className="sticky top-[78px] z-30 -mx-4 min-w-0 bg-paper/90 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden"
      >
        <div ref={railRef} className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1">
          {GROUPS.flat().map(({ tab, Icon }) => {
            const isActive = tab === active;
            const count = counts[tab];
            return (
              <TabLink
                key={tab}
                href={nav.href(tab)}
                onNavigate={() => nav.go(tab)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-10 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${
                  isActive
                    ? "border-signal bg-signal text-white shadow-xs"
                    : "border-line bg-surface text-ink/80 hover:border-signal/40 hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {labels[tab]}
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 font-mono text-[11px] tabular-nums ${
                      isActive ? "bg-white/20 text-white" : "bg-surface-2 text-dusk"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {!count && attention[tab] && !isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                )}
              </TabLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
