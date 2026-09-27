import React from "react";
import type { ProfileCompletionState } from "../../lib/profile/useProfileCompletion.js";
import { useT } from "../../lib/i18n/index.js";
import type { ApplicationStatus, MyApplication } from "../../lib/types.js";
import { HelpCard, TipsCard, type Tip } from "../dashboard/SidebarCards.js";
import { ApplicationStats } from "./ApplicationStats.js";
import { ProfileCompletionPrompt } from "./ProfileCompletionPrompt.js";
import { IconBell, IconFile, IconInterview, IconUser } from "./icons.js";

/**
 * O'ng panel (telefonda ro'yxatdan keyin): "Faol bo'ling!" (profil < 100%),
 * umumiy statistika (arizalar bo'lsa), holatga bog'liq maslahatlar va yordam.
 * Panel sticky emas — balandligi ekrandan oshadi, pastki qismi yashirinib qolmasin.
 */
export function ApplicationsSidebar({
  items,
  counts,
  completion,
}: {
  items: MyApplication[];
  counts: Record<ApplicationStatus, number>;
  completion: ProfileCompletionState;
}) {
  const s = useT().applicationsPage.sidebar;
  const resumeReady = completion.status === "ready" ? completion.resumeReady : null;

  // Maslahatlar holatga qarab: suhbat bo'lsa — tayyorgarlik; profil kartasi ko'rinmasa
  // (foiz aniqlanmadi) — profil maslahati; rezyume to'liq emas — "to'ldiring".
  const tips: Tip[] = [
    ...(counts.invited > 0 ? [{ key: "interview", href: "/articles?category=interview", icon: <IconInterview size={18} />, ...s.tips.interview }] : []),
    ...(completion.status === "error" ? [{ key: "profile", href: "/profile?tab=personal", icon: <IconUser size={18} />, ...s.tips.profile }] : []),
    { key: "resume", href: "/profile?tab=resume", icon: <IconFile size={18} />, ...(resumeReady === false ? s.tips.resumeFill : s.tips.resume) },
    { key: "alerts", href: "/alerts", icon: <IconBell size={18} />, ...s.tips.alerts },
  ];

  return (
    <aside className="flex min-w-0 flex-col gap-5 lg:self-start">
      <ProfileCompletionPrompt state={completion} />
      {items.length > 0 && <ApplicationStats items={items} counts={counts} />}
      <TipsCard id="applications-tips-title" title={s.tipsTitle} allLabel={s.tipsAll} allHref="/articles" tips={tips} />
      <HelpCard id="applications-help-title" title={s.help.title} text={s.help.text} cta={s.help.cta} />
    </aside>
  );
}
