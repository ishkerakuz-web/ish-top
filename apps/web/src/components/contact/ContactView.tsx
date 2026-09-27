import React, { useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { SupportContactsVM } from "../../lib/support/contacts.js";
import { useSupportContacts } from "../../lib/support/hooks.js";
import { ContactHeader } from "./ContactHeader.js";
import { ContactForm, type ContactPreset } from "./ContactForm.js";
import { ContactChannels } from "./ContactChannels.js";
import { ContactPartnership } from "./ContactPartnership.js";
import { ContactFeatureCards } from "./ContactFeatureCards.js";
import { ContactSkeleton } from "./ContactSkeleton.js";
import { ContactChannelsError } from "./ContactError.js";

/**
 * `/contact` — o'zi hal qila olmagan foydalanuvchi uchun: forma birinchi, keyin
 * boshqa kanallar, hamkorlik, oxirida xususiyat kartalari (telefonda ham shu tartib).
 * Kanal/hamkorlik/karta ma'lumoti bo'lmasa — o'sha qism, yon ustun ham chizilmaydi.
 */
export function ContactView({ initial }: { initial: SupportContactsVM | null }) {
  const t = useT();
  const { state, retry } = useSupportContacts(initial);
  const [preset, setPreset] = useState<ContactPreset | null>(null);
  const contacts = state.kind === "ok" ? state.contacts : null;
  const hasAside = state.kind !== "ok" || (contacts !== null && (contacts.channels.length > 0 || contacts.partnership !== null));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 lg:pt-7">
      <ContactHeader />
      <div className={`mt-7 grid items-start gap-6 ${hasAside ? "md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_360px]" : "max-w-3xl"}`}>
        <ContactForm contacts={contacts} preset={preset} />
        {hasAside && (
          <div className="space-y-6">
            {state.kind === "loading" ? (
              <ContactSkeleton label={t.contact.loading} />
            ) : state.kind === "error" ? (
              <ContactChannelsError onRetry={retry} />
            ) : (
              contacts && (
                <>
                  <ContactChannels channels={contacts.channels} />
                  <ContactPartnership
                    partnership={contacts.partnership}
                    onWrite={() => setPreset((current) => ({ subject: "partnership", nonce: (current?.nonce ?? 0) + 1 }))}
                  />
                </>
              )
            )}
          </div>
        )}
      </div>
      {contacts && <ContactFeatureCards responseHours={contacts.responseHours} hours={contacts.hours} />}
    </div>
  );
}
