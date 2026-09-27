import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import { IconSend, Spinner } from "./icons.js";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
/** Server xabarni 4000 belgida kesadi — maydon ham shu chegarada. */
export const MESSAGE_MAX_LENGTH = 4000;

/**
 * Yozish maydoni: balandlik matnga qarab o'sadi (160px gacha), Enter — yuborish,
 * Shift+Enter — yangi qator (IME yozuvi paytida Enter yubormaydi). Bo'sh/probel
 * matn yuborilmaydi. Qoralama suhbat bo'yicha saqlanadi (suhbat almashsa yo'qolmaydi).
 */
export function MessageComposer({
  initial,
  disabled,
  sending,
  onDraft,
  onSend,
}: {
  initial: string;
  disabled: boolean;
  sending: boolean;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
}) {
  const m = useT().messagesPage;
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const hintId = useId();

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    onDraft("");
    ref.current?.focus();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="border-t border-line bg-surface p-3 sm:px-4"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2/50 p-1.5 pl-3 transition-colors focus-within:border-signal/50 focus-within:bg-surface focus-within:ring-2 focus-within:ring-signal/15">
        <label htmlFor={inputId} className="sr-only">
          {m.composer.label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          rows={1}
          value={value}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={disabled}
          placeholder={m.composer.placeholder}
          aria-describedby={hintId}
          onChange={(event) => {
            setValue(event.target.value);
            onDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[16px] leading-6 text-ink placeholder:text-dusk focus:outline-none disabled:cursor-not-allowed sm:text-[14.5px]"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label={m.composer.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal text-white shadow-xs transition-colors hover:bg-signal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? <Spinner size={18} /> : <IconSend size={18} />}
        </button>
      </div>
      <p id={hintId} className="sr-only md:not-sr-only md:mt-1.5 md:px-1 md:text-[11.5px] md:text-dusk">
        {m.composer.hint}
      </p>
    </form>
  );
}
