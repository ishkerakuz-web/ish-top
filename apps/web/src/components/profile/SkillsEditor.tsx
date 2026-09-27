import React, { useEffect, useId, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ResumeData } from "../../lib/types.js";
import { SaveStatus, SectionHeader, inputClass, useSaveState } from "./ui.js";
import { IconPlus, IconSpark, IconX } from "./icons.js";

const AUTOSAVE_MS = 700;
const MAX_LEN = 60;

/**
 * Ko'nikmalar: chip'lar + Enter bilan qo'shish + tavsiyalar.
 * O'zgarishlar avtomatik saqlanadi (qisqa kechikish bilan — ketma-ket bir
 * nechta ko'nikma qo'shilsa, bitta so'rov ketadi). Bo'limdan chiqib ketilsa,
 * kutilayotgan saqlash darhol yuboriladi.
 */
export function SkillsEditor({
  skills,
  saveResume,
  headingAs = "h2",
}: {
  skills: string[];
  saveResume: (patch: Partial<ResumeData>) => Promise<ResumeData>;
  headingAs?: "h1" | "h2" | "h3";
}) {
  const t = useT();
  const s = t.profileHub.skills;
  const inputId = useId();
  const [items, setItems] = useState<string[]>(skills);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saver = useSaveState();
  const timerRef = useRef<number | null>(null);
  // Audit R3, gap5-3: chip o'chirilganda uning tugmasi yo'qoladi — fokus kiritish maydoniga qaytadi
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<string[] | null>(null);
  const saveRef = useRef(saveResume);
  saveRef.current = saveResume;

  // Tashqaridan (server javobi) kelgan qiymat — kutilayotgan o'zgarish bo'lmasa qabul qilinadi.
  useEffect(() => {
    if (!pendingRef.current) setItems(skills);
  }, [skills]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (pendingRef.current) void saveRef.current({ skills: pendingRef.current }).catch(() => undefined);
    },
    []
  );

  function schedule(next: string[]) {
    setItems(next);
    pendingRef.current = next;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const payload = pendingRef.current;
      if (!payload) return;
      void saver.run(async () => {
        const result = await saveRef.current({ skills: payload });
        if (pendingRef.current === payload) pendingRef.current = null;
        return result;
      });
    }, AUTOSAVE_MS);
  }

  function add(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length > MAX_LEN) {
      setError(s.tooLong);
      return;
    }
    if (items.some((x) => x.toLowerCase() === value.toLowerCase())) {
      setError(s.duplicate);
      return;
    }
    setError(null);
    setInput("");
    schedule([...items, value]);
  }

  function remove(skill: string, returnFocus = false) {
    schedule(items.filter((x) => x !== skill));
    if (returnFocus) inputRef.current?.focus();
  }

  const query = input.trim().toLowerCase();
  const taken = new Set(items.map((x) => x.toLowerCase()));
  const suggestions = s.suggestions
    .filter((x) => !taken.has(x.toLowerCase()) && (!query || x.toLowerCase().includes(query)))
    .slice(0, 12);

  return (
    <div>
      <SectionHeader
        as={headingAs}
        title={t.resume.skills}
        subtitle={s.subtitle}
        icon={headingAs === "h1" ? <IconSpark size={19} /> : undefined}
        action={
          <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11.5px] font-semibold tabular-nums text-dusk">
            {s.count(items.length)}
          </span>
        }
      />

      <div className="mt-5">
        <label htmlFor={inputId} className="text-[13px] font-semibold text-ink">
          {t.resume.skills}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id={inputId}
            ref={inputRef}
            value={input}
            maxLength={MAX_LEN + 10}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(input);
              } else if (e.key === "Backspace" && !input && items.length) {
                remove(items[items.length - 1]);
              }
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            placeholder={t.resume.skillsPlaceholder}
            className={`h-11 flex-1 px-3.5 ${inputClass(Boolean(error))}`}
          />
          <button
            type="button"
            onClick={() => add(input)}
            disabled={!input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal text-white transition-all hover:bg-signal-dark active:scale-95 disabled:opacity-40"
            aria-label={t.profileHub.completion.add}
          >
            <IconPlus size={18} />
          </button>
        </div>
        <div className="mt-1.5 flex min-h-[20px] items-center justify-between gap-3">
          {error ? (
            <p id={`${inputId}-error`} className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          ) : (
            <span />
          )}
          <SaveStatus state={saver.state} errorMessage={saver.error} />
        </div>
      </div>

      <div className="mt-3">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface-2/40 px-4 py-5 text-center text-[13.5px] text-dusk">
            {s.empty}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label={t.resume.skills}>
            {items.map((skill) => (
              <li
                key={skill}
                className="inline-flex animate-pop items-center gap-1 rounded-full border border-signal/20 bg-signal-soft py-1 pl-3.5 pr-1 text-[13.5px] font-semibold text-signal"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => remove(skill, true)}
                  aria-label={s.removeLabel(skill)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-signal/70 transition-colors hover:bg-signal/15 hover:text-signal"
                >
                  <IconX size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-dusk">{s.suggested}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((skill) => (
              <li key={skill}>
                <button
                  type="button"
                  onClick={() => add(skill)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-line bg-surface px-3 text-[13px] font-medium text-ink/80 transition-colors hover:border-signal/50 hover:bg-signal-soft hover:text-signal"
                >
                  <IconPlus size={13} />
                  {skill}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
