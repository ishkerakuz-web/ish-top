import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ResumeData } from "../../lib/types.js";
import { Field, SaveStatus, TextArea, TextInput, focusFirstInvalid, useSaveState } from "./ui.js";

type Draft = { title: string; summary: string; desiredSalary: string };

function toDraft(resume: ResumeData | null): Draft {
  return {
    title: resume?.title ?? "",
    summary: resume?.summary ?? "",
    desiredSalary: resume?.desiredSalary ? String(resume.desiredSalary) : "",
  };
}

/**
 * Rezyumening kasbiy qismi: lavozim, o'zi haqida, kutilayotgan maosh.
 * Tugmalar chaqiruvchida (`footer`) — ustoz ichida "Saqlash va davom etish"
 * bitta amal bo'lishi uchun `save()` tashqariga beriladi.
 */
export function ProfessionalInfo({
  resume,
  saveResume,
  footer,
}: {
  resume: ResumeData | null;
  saveResume: (patch: Partial<ResumeData>) => Promise<ResumeData>;
  footer: (api: { save: () => Promise<boolean>; dirty: boolean; saving: boolean; status: React.ReactNode }) => React.ReactNode;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(() => toDraft(resume));
  const [titleError, setTitleError] = useState<string | null>(null);
  const saver = useSaveState();
  const formRef = useRef<HTMLFormElement>(null);
  const initial = toDraft(resume);
  const dirty =
    draft.title !== initial.title || draft.summary !== initial.summary || draft.desiredSalary !== initial.desiredSalary;

  // Server javobi kelgach (yoki boshqa bo'limda saqlanganda) forma yangi holatni oladi.
  useEffect(() => {
    if (!dirty) setDraft(toDraft(resume));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  async function save(): Promise<boolean> {
    if (!draft.title.trim()) {
      // Audit R3, gap5-2: xato e'lon qilinadi va fokus xato maydonga ko'chadi
      setTitleError(t.profileHub.states.required);
      focusFirstInvalid(formRef.current);
      return false;
    }
    if (!dirty) return true;
    const salary = draft.desiredSalary.replace(/\D/g, "");
    const result = await saver.run(() =>
      saveResume({
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        desiredSalary: salary ? Number(salary) : null,
      })
    );
    return Boolean(result);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
        <Field label={t.resume.jobTitle} required error={titleError}>
          {(p) => (
            <TextInput
              id={p.id}
              describedBy={p.describedBy}
              invalid={p.invalid}
              required={p.required}
              value={draft.title}
              maxLength={140}
              onChange={(v) => {
                setDraft({ ...draft, title: v });
                if (v.trim()) setTitleError(null);
              }}
              placeholder={t.resume.jobTitlePlaceholder}
            />
          )}
        </Field>
        <Field label={t.resume.desiredSalary}>
          {(p) => (
            <TextInput
              id={p.id}
              describedBy={p.describedBy}
              inputMode="numeric"
              value={draft.desiredSalary}
              onChange={(v) => setDraft({ ...draft, desiredSalary: v.replace(/\D/g, "").slice(0, 12) })}
              placeholder="10000000"
              className="font-mono tabular-nums"
            />
          )}
        </Field>
        <Field label={t.resume.summary} className="md:col-span-2">
          {(p) => (
            <TextArea
              id={p.id}
              describedBy={p.describedBy}
              value={draft.summary}
              onChange={(v) => setDraft({ ...draft, summary: v })}
              placeholder={t.resume.summaryPlaceholder}
              rows={6}
              maxLength={3000}
            />
          )}
        </Field>
      </div>

      {footer({
        save,
        dirty,
        saving: saver.state === "saving",
        status: <SaveStatus state={saver.state} errorMessage={saver.error} />,
      })}
    </form>
  );
}
