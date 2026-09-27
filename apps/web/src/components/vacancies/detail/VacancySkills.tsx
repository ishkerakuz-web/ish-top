import React, { useId, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";

const VISIBLE = 6;

/**
 * Ko'nikma teglari — /vacancies kartasidagi bilan bir xil manba (talablar
 * matnidan ma'lum ko'nikmalar). Ko'p bo'lsa "+N" tugmasi qolganini ochadi.
 * Ro'yxat bo'sh bo'lsa komponent chaqirilmaydi.
 */
export function VacancySkills({ skills, className = "" }: { skills: string[]; className?: string }) {
  const d = useT().vacancyDetail.skills;
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  if (skills.length === 0) return null;

  const hiddenCount = Math.max(0, skills.length - VISIBLE);
  const shown = expanded ? skills : skills.slice(0, VISIBLE);

  return (
    <div className={className}>
      <h2 className="sr-only">{d.title}</h2>
      <ul id={listId} className="flex flex-wrap gap-2">
        {shown.map((skill) => (
          <li key={skill} className="rounded-xl border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink/85 shadow-xs">
            {skill}
          </li>
        ))}
        {hiddenCount > 0 && (
          <li>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-label={expanded ? d.less : d.more(hiddenCount)}
              onClick={() => setExpanded((v) => !v)}
              className="rounded-xl border border-line bg-surface-2/70 px-3 py-1.5 text-[13px] font-bold text-signal transition-colors hover:border-signal/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {expanded ? d.less : `+${hiddenCount}`}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
