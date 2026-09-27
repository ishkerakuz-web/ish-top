import React, { useRef } from "react";
import { useT } from "../../../../lib/i18n/index.js";
import { applyTextFormat, type TextFormat } from "../../../../lib/employer/vacancies/form.js";
import { IconHeading, IconListBullet, IconListNumber } from "../icons.js";

const IconSubheading = ({ size, className }: { size?: number; className?: string }) => <IconHeading level={3} size={size} className={className} />;

/**
 * Tavsif maydoni: oddiy matn + asboblar paneli. Faqat vakansiya sahifasi haqiqatan
 * chizadigan belgilar (`parseRichText`): ro'yxat, raqamli ro'yxat, kichik sarlavha.
 * Qalin/kursiv/havola yo'q — sahifada ular ko'rinmasdi. Matn HTML sifatida saqlanmaydi.
 */
export function DescriptionEditor({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  min,
  invalid,
  errorId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  min: number;
  invalid: boolean;
  errorId?: string;
}) {
  const e = useT().vacancyForm.editor;
  const ref = useRef<HTMLTextAreaElement>(null);
  const length = value.trim().length;

  const tools: { kind: TextFormat; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { kind: "bullet", label: e.bullet, Icon: IconListBullet },
    { kind: "numbered", label: e.numbered, Icon: IconListNumber },
    { kind: "heading", label: e.heading, Icon: IconSubheading },
  ];

  const format = (kind: TextFormat) => {
    const el = ref.current;
    if (!el) return;
    const next = applyTextFormat(value, el.selectionStart, el.selectionEnd, kind);
    onChange(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-surface shadow-xs transition-colors focus-within:ring-4 ${
        invalid ? "border-danger/60 focus-within:border-danger focus-within:ring-danger/10" : "border-line hover:border-signal/40 focus-within:border-signal focus-within:ring-signal/10"
      }`}
    >
      <div role="toolbar" aria-label={e.toolbar} aria-controls={id} className="flex items-center gap-1 border-b border-line bg-surface-2/60 px-2 py-1.5">
        {tools.map(({ kind, label, Icon }) => (
          <button
            key={kind}
            type="button"
            data-format={kind}
            aria-label={label}
            title={label}
            // Tanlangan matn yo'qolmasin — fokus textarea'da qoladi
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => format(kind)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-dusk transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <Icon size={17} />
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={7}
        aria-invalid={invalid || undefined}
        aria-describedby={[errorId, `${id}-meta`].filter(Boolean).join(" ")}
        className="block min-h-[168px] w-full resize-y bg-transparent px-3.5 py-3 text-[14px] leading-relaxed text-ink placeholder:text-dusk/80 focus:outline-none"
      />
      <div id={`${id}-meta`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-3.5 py-2 text-[12px] text-dusk">
        <span>{e.hint}</span>
        <span data-testid="description-count" className={`tabular-nums ${length > 0 && length < min ? "text-gold-deep" : ""}`}>
          {e.count(length)}
          {length < min ? ` · ${e.min(min)}` : ""}
        </span>
      </div>
    </div>
  );
}
