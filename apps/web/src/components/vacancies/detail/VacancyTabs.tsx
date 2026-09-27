import React, { useRef } from "react";

export interface DetailTab {
  id: string;
  label: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * WAI-ARIA tablar: faqat tanlangan tab Tab tugmasi bilan fokuslanadi,
 * ←/→, Home/End bilan almashadi. Tablar ro'yxati ma'lumotdan tuziladi
 * (sharh yo'q — "Sharhlar" tabi yo'q); bittagina bo'lsa sahifa tablist chizmaydi.
 */
export function VacancyTabs({
  tabs,
  active,
  onChange,
  idPrefix,
  label,
}: {
  tabs: DetailTab[];
  active: string;
  onChange: (id: string) => void;
  idPrefix: string;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="scrollbar-none flex overflow-x-auto border-b border-line px-1.5 sm:gap-3 sm:px-4">
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={tabId(idPrefix, tab.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`relative shrink-0 whitespace-nowrap rounded-t-lg px-2.5 py-4 text-[14px] font-semibold sm:px-3 sm:text-[14.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${
              selected ? "text-ink" : "text-dusk hover:text-ink"
            }`}
          >
            {tab.label}
            <span
              aria-hidden
              className={`absolute inset-x-3 -bottom-px h-[2.5px] origin-center rounded-full bg-signal transition-transform duration-200 ${
                selected ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
