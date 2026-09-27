import React, { useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { MAX_TAGS } from "../../../lib/articles/editing.js";
import { ADMIN_LABEL } from "../AdminStates.js";
import { IconX } from "../icons.js";

/** Teglar: Enter yoki vergul bilan qo'shiladi, registrsiz takror yo'q, 10 tagacha; Backspace — oxirgisini olib tashlaydi. */
export function TagInput({ id, value, onChange, disabled }: { id: string; value: string[]; onChange: (tags: string[]) => void; disabled: boolean }) {
  const f = useT().contentAdmin.editor.fields;
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const next = [...value];
    for (const part of raw.split(",")) {
      const tag = part.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!tag || next.length >= MAX_TAGS || next.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
      next.push(tag);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };

  const Label = disabled ? "p" : "label";
  return (
    <div>
      <Label {...(disabled ? {} : { htmlFor: id })} className={ADMIN_LABEL}>
        {f.tags}
      </Label>
      <div className="mt-1.5 flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 transition-colors focus-within:border-signal">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-signal-soft py-1 pl-2.5 pr-1 text-[12.5px] font-medium text-signal dark:text-indigo-300">
            {tag}
            {!disabled && (
              <button
                type="button"
                aria-label={f.tagRemove(tag)}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-signal/15"
              >
                <IconX size={12} />
              </button>
            )}
          </span>
        ))}
        {!disabled && value.length < MAX_TAGS && (
          <input
            id={id}
            value={draft}
            onChange={(ev) => {
              const next = ev.target.value;
              if (next.includes(",")) add(next);
              else setDraft(next);
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                add(draft);
              } else if (ev.key === "Backspace" && !draft && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => {
              if (draft.trim()) add(draft);
            }}
            placeholder={value.length ? "" : f.tagsPlaceholder}
            aria-describedby={`${id}-hint`}
            className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-dusk focus:outline-none"
          />
        )}
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-dusk">
        {f.tagsHint}
      </p>
    </div>
  );
}
