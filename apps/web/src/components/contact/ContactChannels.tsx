import React, { useId } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ContactChannelKind, ContactChannelVM } from "../../lib/support/contacts.js";
import { IconMail, IconPhone, IconPin, IconTelegram } from "../support/icons.js";

type Icon = React.ComponentType<{ size?: number; className?: string }>;
const ICONS: Record<ContactChannelKind, Icon> = { email: IconMail, telegram: IconTelegram, phone: IconPhone, address: IconPin };

/** "Boshqa aloqa kanallari" — faqat sozlangan kanallar; birortasi ham bo'lmasa karta chizilmaydi. */
export function ContactChannels({ channels }: { channels: ContactChannelVM[] }) {
  const c = useT().contact;
  const headingId = useId();
  if (channels.length === 0) return null;
  return (
    <section aria-labelledby={headingId} data-testid="contact-channels" className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 id={headingId} className="font-display text-lg font-bold text-ink">
        {c.channelsTitle}
      </h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-dusk">{c.channelsText}</p>
      <ul className="mt-5 space-y-4">
        {channels.map((channel) => {
          const Icon = ICONS[channel.kind];
          const label = channel.kind === "telegram" && channel.bot ? c.channels.telegramBot : c.channels[channel.kind];
          return (
            <li key={channel.kind} data-channel={channel.kind} className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal dark:text-indigo-300">
                <Icon size={20} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13.5px] font-semibold text-ink">{label}</p>
                {channel.href ? (
                  <a
                    href={channel.href}
                    {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="mt-0.5 block break-words rounded-sm text-[14px] text-ink/80 underline-offset-4 transition-colors hover:text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    {channel.value}
                    {channel.external && <span className="sr-only"> ({c.channels.newTab})</span>}
                  </a>
                ) : (
                  <p className="mt-0.5 break-words text-[14px] text-ink/80">{channel.value}</p>
                )}
                {channel.kind === "telegram" && channel.bot && <p className="mt-0.5 text-[12.5px] text-dusk">{c.channels.telegramBotHint}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
