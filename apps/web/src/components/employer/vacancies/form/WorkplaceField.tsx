import React from "react";
import { useT } from "../../../../lib/i18n/index.js";
import { WORKPLACE_TYPES } from "../../../../lib/employer/vacancies/form.js";
import type { WorkplaceType } from "../../../../lib/types.js";
import { FieldMessage } from "./FormControls.js";
import { IconBuilding, IconGlobe, IconHome } from "../icons.js";

const ICONS: Record<WorkplaceType, React.ComponentType<{ size?: number; className?: string }>> = {
  office: IconBuilding,
  hybrid: IconHome,
  remote: IconGlobe,
};

/**
 * "Ish joylashuvi *" — uchta aniq variant (radio kartalar). Oddiy `radio` inputlar:
 * klaviatura (strelkalar), ekran o'quvchi va forma fokusi o'z-o'zidan ishlaydi.
 * Birinchi variantning `id` si maydon `id` si — xato bo'lsa fokus shu yerga tushadi.
 */
export function WorkplaceField({
  id,
  value,
  onChange,
  error,
  hint,
  className = "",
}: {
  id: string;
  value: WorkplaceType | "";
  onChange: (value: WorkplaceType) => void;
  error?: string | null;
  hint?: string | null;
  className?: string;
}) {
  const t = useT();
  const f = t.vacancyForm;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <fieldset className={`min-w-0 ${className}`} data-field={id} aria-describedby={describedBy}>
      <legend className="flex flex-wrap items-baseline gap-x-1 text-[13.5px] font-medium text-ink">
        {f.fields.workplace}
        <span aria-hidden className="text-danger">
          *
        </span>
        <span className="sr-only">({f.required})</span>
      </legend>
      <div className="mt-1.5 grid gap-2.5 sm:grid-cols-3">
        {WORKPLACE_TYPES.map((type, i) => {
          const Icon = ICONS[type];
          const checked = value === type;
          const inputId = i === 0 ? id : `${id}-${type}`;
          return (
            <label
              key={type}
              htmlFor={inputId}
              data-workplace={type}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-xs transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-signal ${
                checked
                  ? "border-signal bg-signal-soft/60"
                  : error
                    ? "border-danger/60 bg-surface hover:border-danger"
                    : "border-line bg-surface hover:border-signal/40"
              }`}
            >
              <input
                id={inputId}
                type="radio"
                name={id}
                value={type}
                checked={checked}
                onChange={() => onChange(type)}
                aria-invalid={error ? true : undefined}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  checked ? "bg-signal text-white" : "bg-surface-2 text-dusk"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className={`min-w-0 flex-1 text-[14px] ${checked ? "font-semibold text-ink" : "font-medium text-ink/85"}`}>{t.enums.workplace[type]}</span>
              <span
                aria-hidden
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${checked ? "border-signal" : "border-line"}`}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-signal" />}
              </span>
            </label>
          );
        })}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </fieldset>
  );
}
