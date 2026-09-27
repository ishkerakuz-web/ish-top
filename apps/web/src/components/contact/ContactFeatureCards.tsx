import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconClock, IconSpark } from "../support/icons.js";

/**
 * Kichik kartalar faqat haqiqiy sozlamadan: javob muddati (`SUPPORT_RESPONSE_HOURS`)
 * va ish vaqti (`SUPPORT_HOURS`). Berilmagan va'da yozilmaydi; ikkalasi yo'q — bo'lim yo'q.
 */
export function ContactFeatureCards({ responseHours, hours }: { responseHours: number | null; hours: string | null }) {
  const c = useT().contact;
  const cards = [
    ...(responseHours ? [{ key: "response", icon: <IconSpark size={20} />, title: c.features.responseTitle, text: c.features.responseText(responseHours) }] : []),
    ...(hours ? [{ key: "hours", icon: <IconClock size={20} />, title: c.features.hoursTitle, text: hours }] : []),
  ];
  if (cards.length === 0) return null;
  return (
    <ul data-testid="contact-features" className={`mt-6 grid gap-4 ${cards.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {cards.map((card) => (
        <li key={card.key} data-feature={card.key} className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal dark:text-indigo-300">{card.icon}</span>
          <div className="min-w-0 pt-0.5">
            <p className="font-display text-[15px] font-bold text-ink">{card.title}</p>
            <p className="mt-0.5 text-[13.5px] text-dusk">{card.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
