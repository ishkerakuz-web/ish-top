import React from "react";
import { useHref } from "../../lib/i18n/index.js";
import { IconArrowRight, IconHeadset } from "../applications/icons.js";

/** Akkaunt paneli (arizalar, saqlanganlar) o'ng ustunidagi karta uslubi. */
export const SIDEBAR_CARD = "rounded-3xl border border-line bg-surface p-5 shadow-card";
export const SIDEBAR_TITLE = "font-display text-[16px] font-bold tracking-tight text-ink";

export interface Tip {
  key: string;
  /** Tilsiz yo'l — komponent joriy til prefiksini qo'shadi. */
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}

/** "Foydali maslahatlar" — holatga qarab tanlangan havolalar ro'yxati. */
export function TipsCard({
  id,
  title,
  allLabel,
  allHref,
  tips,
}: {
  id: string;
  title: string;
  allLabel: string;
  allHref: string;
  tips: Tip[];
}) {
  const l = useHref();
  return (
    <section aria-labelledby={id} className={SIDEBAR_CARD}>
      {/* Tor panelda (300px) sarlavha ikki qatorga bo'linmasin — havola kerak bo'lsa pastga tushadi */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={id} className={`${SIDEBAR_TITLE} whitespace-nowrap`}>
          {title}
        </h2>
        <a
          href={l(allHref)}
          aria-describedby={id}
          className="inline-flex shrink-0 items-center gap-1 rounded-md text-[12.5px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {allLabel}
          <IconArrowRight size={13} />
        </a>
      </div>
      <ul className="-mx-2.5 mt-3 space-y-1">
        {tips.map((tip) => (
          <li key={tip.key}>
            <a href={l(tip.href)} className="group flex items-start gap-3 rounded-2xl p-2.5 transition-colors hover:bg-surface-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">{tip.icon}</span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold leading-snug text-ink group-hover:text-signal">{tip.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-dusk">{tip.text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Yordam kerakmi?" — mavjud `/support` sahifasiga. */
export function HelpCard({ id, title, text, cta }: { id: string; title: string; text: string; cta: string }) {
  const l = useHref();
  return (
    <section aria-labelledby={id} className={SIDEBAR_CARD}>
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-signal-soft text-signal">
          <IconHeadset size={20} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className={SIDEBAR_TITLE}>
            {title}
          </h2>
          <p className="mt-1 text-[13.5px] leading-snug text-dusk">{text}</p>
        </div>
      </div>
      <a
        href={l("/support")}
        className="group mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {cta}
        <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  );
}
