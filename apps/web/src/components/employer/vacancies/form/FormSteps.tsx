import React from "react";
import { useT } from "../../../../lib/i18n/index.js";
import type { FormSectionKey } from "../../../../lib/employer/vacancies/form.js";
import { IconCheck } from "../icons.js";

export type StepKey = FormSectionKey | "review";
export const STEP_ORDER: readonly StepKey[] = ["basic", "details", "extra", "review"];

/**
 * 4 bosqich: forma bitta sahifada — 1–3 bo'limlarga o'tkazadi (joriy bo'lim scroll bo'yicha),
 * 4 — "Ko'rib chiqish" (validatsiyadan keyin). Bajarilgan — ✓, xatoli — qizil halqa.
 * Telefonda faqat raqamlar + "1/4 · nomi" qatori.
 */
export function FormSteps({
  current,
  done,
  invalid,
  onSelect,
}: {
  current: StepKey;
  done: Record<StepKey, boolean>;
  invalid: Record<StepKey, boolean>;
  onSelect: (step: StepKey) => void;
}) {
  const f = useT().vacancyForm;
  const index = STEP_ORDER.indexOf(current);

  return (
    <nav aria-label={f.stepsLabel} data-testid="vacancy-form-steps" className="rounded-2xl border border-line bg-surface px-3 py-3 shadow-xs sm:px-4">
      <ol className="flex items-center">
        {STEP_ORDER.map((step, i) => {
          const isCurrent = step === current;
          const hasError = invalid[step] && !isCurrent;
          const isDone = done[step] && !isCurrent && !hasError;
          const circle = isCurrent
            ? "bg-signal text-white shadow-xs"
            : hasError
              ? "bg-danger/10 text-danger ring-1 ring-inset ring-danger/40"
              : isDone
                ? "bg-growth/15 text-growth"
                : "bg-surface-2 text-dusk ring-1 ring-inset ring-line";
          const last = i === STEP_ORDER.length - 1;
          return (
            <li
              key={step}
              data-step={step}
              data-state={isCurrent ? "current" : hasError ? "error" : isDone ? "done" : "todo"}
              className={`flex min-w-0 items-center ${last ? "" : "flex-1"}`}
            >
              <button
                type="button"
                onClick={() => onSelect(step)}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex shrink-0 items-center gap-2.5 rounded-xl p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal lg:pr-2"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-bold tabular-nums transition-colors ${circle}`}>
                  {isDone ? <IconCheck size={16} /> : i + 1}
                </span>
                {/* Yozuv qirqilmaydi — bo'sh joyni oraliq chiziqlar oladi */}
                <span className={`hidden whitespace-nowrap text-[13.5px] lg:block ${isCurrent ? "font-semibold text-ink" : "font-medium text-dusk group-hover:text-ink"}`}>
                  {f.steps[step]}
                </span>
                <span className="sr-only lg:hidden">{f.steps[step]}</span>
                {isDone && <span className="sr-only">({f.stepDone})</span>}
                {hasError && <span className="sr-only">({f.stepHasErrors})</span>}
              </button>
              {!last && <span aria-hidden className={`mx-2 h-px min-w-[12px] flex-1 sm:mx-3 ${i < index ? "bg-signal/40" : "bg-line"}`} />}
            </li>
          );
        })}
      </ol>
      <p aria-hidden className="mt-2 px-1 text-[13px] font-medium text-ink lg:hidden">
        {f.stepProgress(index + 1, STEP_ORDER.length, f.steps[current])}
      </p>
    </nav>
  );
}
