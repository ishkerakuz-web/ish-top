import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ContactSubjectKey } from "../../lib/i18n/types.js";
import { errorId, fieldClass } from "./ContactField.js";
import { IconChevronDown } from "../support/icons.js";

/** Mavzu — oddiy `<select>` (klaviatura va telefon tanlagichi o'z-o'zidan ishlaydi). Qiymatlar backend enum'idan. */
export function ContactSubjectSelect({
  id,
  value,
  subjects,
  invalid,
  onChange,
  onBlur,
}: {
  id: string;
  value: ContactSubjectKey | "";
  subjects: readonly ContactSubjectKey[];
  invalid: boolean;
  onChange: (value: ContactSubjectKey | "") => void;
  onBlur: () => void;
}) {
  const c = useT().contact;
  return (
    <div className="relative">
      <select
        id={id}
        name="subject"
        value={value}
        onChange={(e) => onChange(e.target.value as ContactSubjectKey | "")}
        onBlur={onBlur}
        aria-required="true"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId(id) : undefined}
        className={`${fieldClass(invalid)} h-12 cursor-pointer appearance-none pr-10 dark:[color-scheme:dark] ${value ? "" : "text-dusk"}`}
      >
        <option value="" disabled>
          {c.subjectPlaceholder}
        </option>
        {subjects.map((subject) => (
          <option key={subject} value={subject} className="text-ink">
            {c.subjects[subject]}
          </option>
        ))}
      </select>
      <IconChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-dusk" />
    </div>
  );
}
