import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { SKILLS_TARGET, type CompletionItem } from "../../lib/profile/completion.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { Card, ProgressRing, TabLink } from "./ui.js";
import { IconArrowRight, IconCheck } from "./icons.js";

export function ProfileCompletion({
  completion,
  skillsCount,
}: {
  completion: { items: CompletionItem[]; done: number; total: number; percent: number };
  skillsCount: number;
}) {
  const t = useT();
  const nav = useProfileNav();
  const c = t.profileHub.completion;
  const complete = completion.percent >= 100;
  // Bajarilmaganlar tepada — foydalanuvchi keyingi qadamni izlab o'tirmaydi.
  const ordered = [...completion.items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Card className="p-5 sm:p-6" aria-labelledby="completion-title">
      <div className="flex items-center gap-4">
        <ProgressRing value={completion.percent} size={72} stroke={7} label={t.profileHub.header.completion}>
          <span className={`font-display text-[17px] font-extrabold tabular-nums ${complete ? "text-growth" : "text-ink"}`}>
            {completion.percent}%
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <h2 id="completion-title" className="font-display text-[17px] font-bold leading-snug tracking-tight text-ink">
            {c.title(completion.percent)}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-dusk">{complete ? c.subtitleDone : c.subtitle}</p>
          <p className="mt-1.5 font-mono text-[11.5px] font-semibold tabular-nums text-signal">
            {c.progress(completion.done, completion.total)}
          </p>
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-1.5">
        {ordered.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${item.done ? "" : "bg-surface-2/60"}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                item.done ? "bg-growth text-white" : "border-2 border-dashed border-line"
              }`}
              aria-hidden
            >
              {item.done && <IconCheck size={14} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] ${item.done ? "text-dusk" : "font-semibold text-ink"}`}>
                {c.items[item.key]}
                <span className="sr-only">{item.done ? " ✓" : ""}</span>
              </span>
              {item.key === "skills" && !item.done && (
                <span className="block text-xs text-dusk">{c.skillsHint(skillsCount, SKILLS_TARGET)}</span>
              )}
            </span>
            {!item.done && (
              <TabLink
                href={nav.href(item.tab)}
                onNavigate={() => nav.go(item.tab)}
                className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-signal transition-colors hover:bg-signal-soft"
                aria-label={`${c.add}: ${c.items[item.key]}`}
              >
                {c.add}
                <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </TabLink>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
