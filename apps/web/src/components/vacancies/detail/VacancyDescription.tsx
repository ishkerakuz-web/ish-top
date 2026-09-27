import React, { memo, useId, useMemo } from "react";
import { parseRichText } from "../../../lib/vacancies/detail.js";

export const SECTION_TITLE = "font-display text-xl font-bold tracking-tight text-ink";

/**
 * "Vakansiya haqida" matni: paragraf, kichik sarlavha va ro'yxatlar
 * (lib/vacancies/detail.ts → parseRichText). Matn React orqali chiqadi —
 * HTML sifatida ishlanmaydi. Bo'sh bo'lsa bo'lim yo'q.
 */
export const VacancyDescription = memo(function VacancyDescription({ text, title }: { text: string; title: string }) {
  const headingId = useId();
  const blocks = useMemo(() => parseRichText(text), [text]);
  if (blocks.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={SECTION_TITLE}>
        {title}
      </h2>
      <div className="mt-3 space-y-3.5 text-[15px] leading-[1.75] text-ink/80">
        {blocks.map((block, i) => {
          if (block.kind === "p") {
            return (
              <p key={i} className="whitespace-pre-line [overflow-wrap:anywhere]">
                {block.text}
              </p>
            );
          }
          if (block.kind === "h") {
            return (
              <h3 key={i} className="pt-1 font-display text-[16px] font-bold text-ink">
                {block.text}
              </h3>
            );
          }
          if (block.kind === "ol") {
            return (
              <ol key={i} className="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-signal">
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1 [overflow-wrap:anywhere]">
                    {item}
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span aria-hidden className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </section>
  );
});
