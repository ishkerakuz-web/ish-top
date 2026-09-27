import React, { useId } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { SupportContactsVM } from "../../lib/support/contacts.js";
import { IconUsers } from "../support/icons.js";

// Telefonda karta kengligida (ikonka ostidan), kattaroq ekranda matn ustuni bilan tekislangan
const CTA =
  "mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-growth/40 bg-surface px-4 text-[13.5px] font-semibold text-growth transition-colors hover:bg-growth/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-growth sm:ml-[58px] sm:h-10 sm:w-auto";

/**
 * "Biznes hamkorlik" — faqat yo'l bor bo'lsa: forma ishlasa "Hamkorlik" mavzusi
 * tanlanadi, aks holda sozlangan hamkorlik pochtasi. Ikkalasi ham yo'q — karta yo'q.
 */
export function ContactPartnership({ partnership, onWrite }: { partnership: SupportContactsVM["partnership"]; onWrite: () => void }) {
  const c = useT().contact;
  const headingId = useId();
  if (!partnership) return null;
  return (
    <section aria-labelledby={headingId} data-testid="contact-partnership" className="rounded-3xl border border-growth/20 bg-growth/[0.06] p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-growth/10 text-growth">
          <IconUsers size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-display text-[16px] font-bold text-ink">
            {c.partnership.title}
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-dusk">{c.partnership.text}</p>
        </div>
      </div>
      {partnership.viaForm ? (
        <button type="button" onClick={onWrite} className={CTA}>
          {c.partnership.cta}
        </button>
      ) : partnership.email ? (
        <a href={`mailto:${partnership.email}`} className={CTA}>
          {c.partnership.cta}
        </a>
      ) : null}
      {partnership.viaForm && partnership.email && (
        <a
          href={`mailto:${partnership.email}`}
          className="mt-2 block break-words text-center text-[12.5px] text-dusk transition-colors hover:text-growth hover:underline sm:ml-[58px] sm:text-left"
        >
          {partnership.email}
        </a>
      )}
    </section>
  );
}
