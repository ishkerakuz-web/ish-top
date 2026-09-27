import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconCheckCircle } from "../support/icons.js";

/** Yuborilgandan keyin: ✓, "Xabaringiz yuborildi." Fokus sarlavhaga o'tadi (ekran o'quvchi e'lon qiladi). */
export const ContactSuccess = React.forwardRef<HTMLHeadingElement, { onAgain: () => void }>(function ContactSuccess({ onAgain }, ref) {
  const c = useT().contact;
  return (
    <div data-testid="contact-success" className="flex flex-col items-center px-2 py-10 text-center sm:py-14">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-growth/10 text-growth">
        <IconCheckCircle size={34} />
      </span>
      <h2 ref={ref} tabIndex={-1} className="mt-5 font-display text-xl font-bold text-ink focus:outline-none">
        {c.successTitle}
      </h2>
      <p className="mt-1.5 max-w-sm text-[14.5px] text-dusk">{c.successText}</p>
      <button
        type="button"
        onClick={onAgain}
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal sm:w-auto"
      >
        {c.sendAnother}
      </button>
    </div>
  );
});
