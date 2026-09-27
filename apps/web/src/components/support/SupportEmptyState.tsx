import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../articles/ArticleStatePanel.js";
import { IconArrowRight, IconHelp, IconSearch } from "./icons.js";

function StatePanel({ icon, title, text, testId, children }: { icon: React.ReactNode; title: string; text: string; testId: string; children: React.ReactNode }) {
  return (
    <div data-testid={testId} className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-5 py-12 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-signal-soft text-signal dark:text-indigo-300">{icon}</span>
      <h2 className="mt-5 max-w-md font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] text-dusk">{text}</p>
      <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">{children}</div>
    </div>
  );
}

/** Qidiruv/filtr bo'yicha hech narsa topilmadi — boshqa so'z yoki jamoaga yozish. */
export function SupportEmptyState({ onClear }: { onClear: () => void }) {
  const s = useT().support;
  const l = useHref();
  return (
    <StatePanel testId="support-empty" icon={<IconSearch size={26} />} title={s.emptyTitle} text={s.emptyText}>
      <a href={l("/contact")} className={`${PRIMARY_BUTTON} justify-center`}>
        {s.contactButton}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>
      <button type="button" onClick={onClear} className={`${SECONDARY_BUTTON} justify-center`}>
        {s.showAll}
      </button>
    </StatePanel>
  );
}

/** Lug'atda birorta ham yaroqli savol yo'q — kategoriya va accordion o'rniga. */
export function SupportNoFaqState() {
  const s = useT().support;
  const l = useHref();
  return (
    <StatePanel testId="support-no-faq" icon={<IconHelp size={26} />} title={s.noFaqTitle} text={s.noFaqText}>
      <a href={l("/contact")} className={`${PRIMARY_BUTTON} justify-center`}>
        {s.contactButton}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </StatePanel>
  );
}
