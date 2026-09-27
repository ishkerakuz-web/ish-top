import React from "react";
import { useHref, useT } from "../../lib/i18n/index.js";
import type { Inline } from "../../lib/articles/content.js";

const LINK =
  "rounded-sm font-semibold text-signal underline decoration-signal/30 underline-offset-4 transition-colors hover:decoration-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-indigo-300";

/**
 * FAQ javobi. Matn React elementlari sifatida chiqadi (HTML ishlanmaydi). Ichki
 * havola (`/profile`, `/contact`…) joriy tilga moslanadi, tashqisi yangi oynada.
 */
export function SupportAnswer({ paragraphs }: { paragraphs: Inline[][] }) {
  const l = useHref();
  const newTab = useT().contact.channels.newTab;

  const inline = (nodes: Inline[]): React.ReactNode =>
    nodes.map((node, i) => {
      switch (node.kind) {
        case "text":
          return <React.Fragment key={i}>{node.text}</React.Fragment>;
        case "strong":
          return (
            <strong key={i} className="font-semibold text-ink">
              {inline(node.children)}
            </strong>
          );
        case "em":
          return <em key={i}>{inline(node.children)}</em>;
        case "link":
          return node.external ? (
            <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className={LINK}>
              {inline(node.children)}
              <span className="sr-only"> ({newTab})</span>
            </a>
          ) : (
            <a key={i} href={l(node.href)} className={LINK}>
              {inline(node.children)}
            </a>
          );
      }
    });

  return (
    <div className="max-w-prose space-y-2.5 text-[14.5px] leading-relaxed text-ink/75">
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{inline(paragraph)}</p>
      ))}
    </div>
  );
}
