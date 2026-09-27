import React, { useEffect, useId, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { sendArticleFeedback } from "../../../lib/articles/api.js";
import { IconCheck, IconThumbDown, IconThumbUp } from "../icons.js";
import { SIDE_CARD, SIDE_TITLE } from "./styles.js";

const storageKey = (slug: string) => `ishbor:article-feedback:${slug}`;

/**
 * "Foydali bo'ldimi?" — ovoz serverga yoziladi (maqolaning helpful sonlari,
 * admin tahrirlash sahifasida ko'rinadi). Brauzer ovoz berilganini eslab qoladi.
 */
export function ArticleFeedback({ slug }: { slug: string }) {
  const h = useT().articles.detail.helpful;
  const headingId = useId();
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey(slug))) setState("done");
    } catch {
      /* saqlash yopiq (maxfiy rejim) — ovoz berish baribir ishlaydi */
    }
  }, [slug]);

  const vote = async (helpful: boolean) => {
    setState("sending");
    try {
      await sendArticleFeedback(slug, helpful);
      try {
        window.localStorage.setItem(storageKey(slug), helpful ? "yes" : "no");
      } catch {
        /* e'tiborsiz */
      }
      setState("done");
    } catch {
      setState("failed");
    }
  };

  const button =
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  return (
    <section aria-labelledby={headingId} className={SIDE_CARD} data-testid="article-feedback">
      <h2 id={headingId} className={SIDE_TITLE}>
        {h.title}
      </h2>
      {state === "done" ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-[14px] font-medium text-growth">
          <IconCheck size={17} />
          {h.thanks}
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={button} disabled={state === "sending"} onClick={() => void vote(true)}>
              <IconThumbUp size={17} />
              {h.yes}
            </button>
            <button type="button" className={button} disabled={state === "sending"} onClick={() => void vote(false)}>
              <IconThumbDown size={17} />
              {h.no}
            </button>
          </div>
          {state === "failed" && (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {h.failed}
            </p>
          )}
        </>
      )}
    </section>
  );
}
