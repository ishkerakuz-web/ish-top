import React, { useId } from "react";
import type { SupportItemVM } from "../../lib/support/faq.js";
import { SupportFaqItem } from "./SupportFaqItem.js";

/** "Tez-tez so'raladigan savollar" — bitta javob ochiq turadi (mavjud sahifadagi naqsh). */
export function SupportFaq({
  items,
  title,
  resultsLabel,
  openId,
  onToggle,
}: {
  items: SupportItemVM[];
  title: string;
  resultsLabel: string | null;
  openId: string | null;
  onToggle: (id: string) => void;
}) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section id="support-faq" aria-labelledby={headingId} className="mt-10 scroll-mt-24" data-testid="support-faq">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-display text-xl font-bold tracking-tight text-ink">
          {title}
        </h2>
        {resultsLabel && (
          <p className="text-[13px] font-medium tabular-nums text-dusk" data-testid="support-results">
            {resultsLabel}
          </p>
        )}
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <SupportFaqItem key={item.id} item={item} open={openId === item.id} onToggle={() => onToggle(item.id)} />
        ))}
      </ul>
    </section>
  );
}
