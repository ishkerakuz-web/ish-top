import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import { IconHeart, IconShare } from "./icons.js";

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";
const IDLE = "border-line bg-surface text-ink hover:border-signal/40 hover:text-signal";
const ACTIVE = "border-signal/40 bg-signal-soft text-signal";

/**
 * Saqlash + ulashish. Saqlash — mavjud sevimlilar mexanizmi (sahifadan
 * `onToggleSave`); berilmasa (masalan ish beruvchi) tugma chiqmaydi.
 */
export function VacancyActions({
  saved,
  onToggleSave,
  onShare,
  className = "",
}: {
  saved: boolean;
  onToggleSave?: () => void;
  onShare: () => void;
  className?: string;
}) {
  const d = useT().vacancyDetail.actions;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={onShare} className={`${BUTTON} ${IDLE}`}>
        <IconShare size={17} />
        {d.share}
      </button>
      {onToggleSave && (
        <button type="button" aria-pressed={saved} onClick={onToggleSave} className={`${BUTTON} ${saved ? ACTIVE : IDLE}`}>
          <IconHeart size={17} filled={saved} />
          {saved ? d.saved : d.save}
        </button>
      )}
    </div>
  );
}
