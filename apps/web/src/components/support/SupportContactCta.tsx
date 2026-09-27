import React, { useId } from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import { IconArrowRight, IconHeadset } from "./icons.js";

/** Sahifa oxirida: "Savolingizga javob topmadingizmi?" → `/contact`. */
export function SupportContactCta() {
  const s = useT().support;
  const l = useHref();
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="mt-12 flex flex-col items-start gap-5 rounded-3xl border border-signal/15 bg-signal-soft/70 p-5 sm:flex-row sm:items-center sm:p-6 dark:border-signal/25"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-signal shadow-card dark:text-indigo-300">
        <IconHeadset size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={headingId} className="font-display text-lg font-bold text-ink">
          {s.stillTitle}
        </h2>
        <p className="mt-1 text-[14px] text-dusk">{s.stillDesc}</p>
      </div>
      <a
        href={l("/contact")}
        data-testid="support-contact-cta"
        className="group inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:w-auto"
      >
        {s.contactButton}
        <IconArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  );
}
