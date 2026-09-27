import React, { useLayoutEffect, useRef, useState } from "react";
import { useLocale, useT } from "../../../lib/i18n/index.js";
import { COVER_MAX_BYTES, COVER_TYPES, applyFormat, type FormatKind } from "../../../lib/articles/editing.js";
import { uploadArticleCover } from "../../../lib/admin/articles.js";
import { errorText } from "../../../lib/admin/useNotice.js";
import { ADMIN_LABEL } from "../AdminStates.js";
import {
  IconBold,
  IconDivider,
  IconHeading,
  IconImage,
  IconItalic,
  IconLightbulb,
  IconLink,
  IconListBullet,
  IconListNumber,
  IconQuote,
  Spinner,
} from "../icons.js";

/**
 * Maqola matni muharriri: Markdown'ning cheklangan to'plami + asboblar paneli
 * (H2, H3, qalin, kursiv, ro'yxatlar, havola, iqtibos, maslahat, rasm, ajratkich).
 * Saytda matn xavfsiz parser orqali chiqadi — HTML yozilsa oddiy matn bo'lib qoladi.
 * Klaviatura: Ctrl/⌘+B, Ctrl/⌘+I, Ctrl/⌘+K.
 */
export function ContentEditor({
  id,
  value,
  onChange,
  disabled,
  error,
  token,
  onUploadError,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  token: string | null;
  onUploadError: (message: string) => void;
}) {
  const t = useT();
  const e = t.contentAdmin.editor;
  const { locale } = useLocale();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const pendingSelection = useRef<[number, number] | null>(null);

  // Tanlov yangi matn chizilgach DARHOL (layout effect) qo'yiladi — keyingi tugma
  // bosilishidan oldin. rAF'da qo'yilganda tez yozilgan harflar aralashib ketardi.
  useLayoutEffect(() => {
    const range = pendingSelection.current;
    if (!range || !ref.current) return;
    pendingSelection.current = null;
    ref.current.focus();
    ref.current.setSelectionRange(range[0], range[1]);
  }, [value]);

  const select = (start: number, end: number) => {
    pendingSelection.current = [start, end];
  };

  const apply = (kind: FormatKind) => {
    const el = ref.current;
    if (!el || disabled) return;
    const placeholder = kind === "link" ? e.toolbar.linkText : e.toolbar[kind === "divider" ? "divider" : kind].toLowerCase();
    const result = applyFormat(value, el.selectionStart, el.selectionEnd, kind, placeholder);
    onChange(result.value);
    select(result.selectionStart, result.selectionEnd);
  };

  const insertImage = async (file: File) => {
    if (!COVER_TYPES.includes(file.type)) return onUploadError(e.errors.coverType);
    if (file.size > COVER_MAX_BYTES) return onUploadError(e.errors.coverSize);
    setUploading(true);
    try {
      const { url } = await uploadArticleCover(token ?? "", file);
      const pos = ref.current?.selectionEnd ?? value.length;
      const before = value.slice(0, pos);
      const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const alt = e.toolbar.imageAlt;
      const insert = `${lead}![${alt}](${url})\n\n`;
      onChange(`${before}${insert}${value.slice(pos)}`);
      const altStart = pos + lead.length + 2;
      select(altStart, altStart + alt.length);
    } catch (err) {
      onUploadError(errorText(err, e.errors.generic, locale));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const tools: ({ kind: FormatKind; label: string; icon: React.ReactNode } | "sep")[] = [
    { kind: "h2", label: e.toolbar.h2, icon: <IconHeading level={2} /> },
    { kind: "h3", label: e.toolbar.h3, icon: <IconHeading level={3} /> },
    "sep",
    { kind: "bold", label: e.toolbar.bold, icon: <IconBold size={17} /> },
    { kind: "italic", label: e.toolbar.italic, icon: <IconItalic size={17} /> },
    { kind: "link", label: e.toolbar.link, icon: <IconLink size={17} /> },
    "sep",
    { kind: "ul", label: e.toolbar.ul, icon: <IconListBullet size={17} /> },
    { kind: "ol", label: e.toolbar.ol, icon: <IconListNumber size={17} /> },
    { kind: "quote", label: e.toolbar.quote, icon: <IconQuote size={17} /> },
    { kind: "tip", label: e.toolbar.tip, icon: <IconLightbulb size={17} /> },
    { kind: "divider", label: e.toolbar.divider, icon: <IconDivider size={17} /> },
  ];

  const toolButton =
    "flex h-8 w-8 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>
        {e.fields.content}
      </label>
      <div className={`mt-1.5 overflow-hidden rounded-xl border bg-surface transition-colors focus-within:border-signal ${error ? "border-danger" : "border-line"}`}>
        <div role="toolbar" aria-label={e.toolbar.label} aria-controls={id} className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-2 px-1.5 py-1.5">
          {tools.map((tool, i) =>
            tool === "sep" ? (
              <span key={`sep-${i}`} aria-hidden className="mx-1 h-5 w-px bg-line" />
            ) : (
              <button
                key={tool.kind}
                type="button"
                aria-label={tool.label}
                title={tool.label}
                disabled={disabled}
                data-format={tool.kind}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => apply(tool.kind)}
                className={toolButton}
              >
                {tool.icon}
              </button>
            )
          )}
          <span aria-hidden className="mx-1 h-5 w-px bg-line" />
          <button
            type="button"
            aria-label={e.toolbar.image}
            title={e.toolbar.image}
            disabled={disabled || uploading || !token}
            data-format="image"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={toolButton}
          >
            {uploading ? <Spinner size={16} /> : <IconImage size={17} />}
          </button>
        </div>
        <textarea
          id={id}
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(ev) => onChange(ev.target.value)}
          onKeyDown={(ev) => {
            if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
            const key = ev.key.toLowerCase();
            const kind = key === "b" ? "bold" : key === "i" ? "italic" : key === "k" ? "link" : null;
            if (!kind) return;
            ev.preventDefault();
            apply(kind);
          }}
          rows={18}
          spellCheck
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          className="block min-h-[360px] w-full resize-y bg-surface px-4 py-3 font-mono text-[13.5px] leading-relaxed text-ink placeholder:text-dusk focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-dusk"
        />
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-dusk">
        {e.fields.contentHint}
      </p>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={COVER_TYPES.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        data-testid="content-image-input"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) void insertImage(file);
        }}
      />
    </div>
  );
}
