import React, { useEffect, useId, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ResumeData, ResumeEducationItem } from "../../lib/types.js";
import { Button, EmptyState, Field, SaveStatus, SectionHeader, TextInput, focusFirstInvalid, useSaveState } from "./ui.js";
import { IconCap, IconPencil, IconPlus, IconTrash } from "./icons.js";

const EMPTY: ResumeEducationItem = {
  institution: "",
  degree: null,
  field: null,
  startYear: new Date().getFullYear(),
  endYear: null,
};

type EditorState = { index: number | "new"; item: ResumeEducationItem } | null;

/** Ta'lim — tajriba bilan bir xil naqsh: kartochka + tahrirlovchi, darhol saqlanadi. */
export function EducationList({
  items,
  saveResume,
  headingAs = "h2",
}: {
  items: ResumeEducationItem[];
  saveResume: (patch: Partial<ResumeData>) => Promise<ResumeData>;
  headingAs?: "h1" | "h2" | "h3";
}) {
  const t = useT();
  const hub = t.profileHub;
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const saver = useSaveState();

  // Audit R3, gap5-3: tahrirlovchi yopilgach fokus chaqirgan tugmaga qaytadi
  const uid = useId();
  const btnId = (key: string) => `${uid}-${key}`;
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(btnId(focusKey))?.focus();
    setFocusKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  function closeEditor(key: string) {
    setEditor(null);
    setFocusKey(key);
  }

  async function commit(next: ResumeEducationItem[]) {
    return Boolean(await saver.run(() => saveResume({ education: next })));
  }

  return (
    <div>
      <SectionHeader
        as={headingAs}
        title={t.resume.education}
        subtitle={hub.education.subtitle}
        icon={headingAs === "h1" ? <IconCap size={19} /> : undefined}
        action={
          <>
          <SaveStatus state={saver.state} errorMessage={saver.error} />
          <Button
            id={btnId("add")}
            variant="secondary"
            size="sm"
            onClick={() => {
              setConfirmIndex(null);
              setEditor({ index: "new", item: { ...EMPTY } });
            }}
            disabled={editor?.index === "new"}
          >
            <IconPlus size={15} /> {t.resume.addEducation}
          </Button>
          </>
        }
      />

      <div className="mt-5 flex flex-col gap-3">
        {editor?.index === "new" && (
          <EducationEditor
            title={hub.education.newTitle}
            initial={editor.item}
            saving={saver.state === "saving"}
            onCancel={() => closeEditor("add")}
            onSubmit={async (item) => {
              if (await commit([item, ...items])) closeEditor("edit-0");
            }}
          />
        )}

        {items.length === 0 && editor?.index !== "new" ? (
          <EmptyState
            icon={<IconCap size={20} />}
            title={t.resume.emptyEducation}
            hint={hub.education.emptyHint}
            action={
              <Button size="sm" onClick={() => setEditor({ index: "new", item: { ...EMPTY } })}>
                <IconPlus size={15} /> {t.resume.addEducation}
              </Button>
            }
          />
        ) : (
          items.map((item, index) =>
            editor?.index === index ? (
              <EducationEditor
                key={`edit-${index}`}
                title={hub.education.editTitle}
                initial={editor.item}
                saving={saver.state === "saving"}
                onCancel={() => closeEditor(`edit-${index}`)}
                onSubmit={async (next) => {
                  if (await commit(items.map((x, i) => (i === index ? next : x)))) closeEditor(`edit-${index}`);
                }}
              />
            ) : (
              <article
                key={`${item.institution}-${item.startYear}-${index}`}
                className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-signal/25 sm:p-5"
              >
                <div className="flex gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-deep" aria-hidden>
                    <IconCap size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold leading-snug text-ink">{item.institution}</h3>
                        {(item.field || item.degree) && (
                          <p className="mt-0.5 text-[13.5px] font-medium text-ink/75">
                            {[item.field, item.degree].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <p className="mt-1 text-[12.5px] text-dusk">
                          {item.startYear} — {item.endYear ?? hub.resume.present}
                        </p>
                      </div>
                      {confirmIndex !== index && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            id={btnId(`edit-${index}`)}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setConfirmIndex(null);
                              setEditor({ index, item });
                            }}
                            aria-label={`${hub.experience.edit}: ${item.institution}`}
                          >
                            <IconPencil size={15} />
                            <span className="hidden sm:inline">{hub.experience.edit}</span>
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setConfirmIndex(index)}
                            aria-label={`${hub.experience.delete}: ${item.institution}`}
                          >
                            <IconTrash size={15} />
                          </Button>
                        </div>
                      )}
                    </div>
                    {confirmIndex === index && (
                      <div className="mt-3 flex animate-fade-in flex-wrap items-center gap-2 rounded-xl bg-danger/5 px-3 py-2.5" role="alert">
                        <span className="mr-auto text-[13px] font-medium text-danger">{hub.experience.confirmDelete}</span>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmIndex(null)}>
                          {hub.states.cancel}
                        </Button>
                        <Button
                          size="sm"
                          className="!bg-danger hover:!bg-danger/90"
                          loading={saver.state === "saving"}
                          onClick={async () => {
                            if (!(await commit(items.filter((_, i) => i !== index)))) return;
                            setConfirmIndex(null);
                            const left = items.length - 1;
                            setFocusKey(left > 0 ? `edit-${Math.min(index, left - 1)}` : "add");
                          }}
                        >
                          {hub.experience.delete}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          )
        )}
      </div>
    </div>
  );
}

function EducationEditor({
  title,
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: ResumeEducationItem;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (item: ResumeEducationItem) => void | Promise<void>;
}) {
  const t = useT();
  const hub = t.profileHub;
  const [item, setItem] = useState({
    institution: initial.institution,
    field: initial.field ?? "",
    degree: initial.degree ?? "",
    startYear: initial.startYear ? String(initial.startYear) : "",
    endYear: initial.endYear ? String(initial.endYear) : "",
  });
  const [errors, setErrors] = useState<Partial<Record<"institution" | "startYear" | "endYear", string>>>({});

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const yearOk = (y: number) => Number.isInteger(y) && y >= 1950 && y <= 2100;

  function validate(): boolean {
    const next: typeof errors = {};
    const start = Number(item.startYear);
    const end = item.endYear ? Number(item.endYear) : null;
    if (!item.institution.trim()) next.institution = hub.states.required;
    if (!item.startYear) next.startYear = hub.states.required;
    else if (!yearOk(start)) next.startYear = hub.education.invalidYear;
    if (end !== null && !yearOk(end)) next.endYear = hub.education.invalidYear;
    else if (end !== null && yearOk(start) && end < start) next.endYear = hub.education.invalidYears;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        // Audit R3, gap5-2: xato maydonga fokus
        if (!validate()) {
          focusFirstInvalid(form);
          return;
        }
        void onSubmit({
          institution: item.institution.trim(),
          field: item.field.trim() || null,
          degree: item.degree.trim() || null,
          startYear: Number(item.startYear),
          endYear: item.endYear ? Number(item.endYear) : null,
        });
      }}
      className="animate-fade-in rounded-2xl border border-signal/30 bg-signal-soft/40 p-4 sm:p-5"
      aria-label={title}
    >
      <p className="font-display text-[15px] font-bold text-ink">{title}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={t.resume.institution} required error={errors.institution} className="sm:col-span-2">
          {(p) => (
            <TextInput
              id={p.id}
              describedBy={p.describedBy}
              invalid={p.invalid}
              required={p.required}
              value={item.institution}
              maxLength={160}
              autoFocus
              onChange={(v) => setItem({ ...item, institution: v })}
            />
          )}
        </Field>
        <Field label={t.resume.field}>
          {(p) => (
            <TextInput id={p.id} value={item.field} maxLength={120} onChange={(v) => setItem({ ...item, field: v })} />
          )}
        </Field>
        <Field label={t.resume.degree}>
          {(p) => (
            <TextInput id={p.id} value={item.degree} maxLength={120} onChange={(v) => setItem({ ...item, degree: v })} />
          )}
        </Field>
        <Field label={t.resume.startYear} required error={errors.startYear}>
          {(p) => (
            <TextInput
              id={p.id}
              describedBy={p.describedBy}
              invalid={p.invalid}
              required={p.required}
              inputMode="numeric"
              value={item.startYear}
              onChange={(v) => setItem({ ...item, startYear: digits(v) })}
              placeholder="2018"
              className="font-mono tabular-nums"
            />
          )}
        </Field>
        <Field label={t.resume.endYear} error={errors.endYear}>
          {(p) => (
            <TextInput
              id={p.id}
              describedBy={p.describedBy}
              invalid={p.invalid}
              inputMode="numeric"
              value={item.endYear}
              onChange={(v) => setItem({ ...item, endYear: digits(v) })}
              placeholder="2022"
              className="font-mono tabular-nums"
            />
          )}
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {hub.states.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {t.profile.save}
        </Button>
      </div>
    </form>
  );
}
