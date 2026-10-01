import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ContactSubjectKey } from "../../lib/i18n/types.js";
import { errorId, fieldClass } from "./ContactField.js";
import { Select } from "../Select.js";

/** Mavzu tanlovi. Qiymatlar backend enum'idan; ko'rinishi saytning qolgan tanlagichlari bilan bir xil. */
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
    <div onBlur={onBlur}>
      <Select
        id={id}
        name="subject"
        ariaLabel={c.subjectPlaceholder}
        placeholder={c.subjectPlaceholder}
        value={value}
        onChange={(next) => onChange(next as ContactSubjectKey | "")}
        options={subjects.map((subject) => ({ value: subject, label: c.subjects[subject] }))}
        required
        invalid={invalid}
        describedBy={invalid ? errorId(id) : undefined}
        buttonClassName={`${fieldClass(invalid)} h-12`}
      />
    </div>
  );
}
