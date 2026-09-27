import React, { useEffect, useId, useRef, useState } from "react";
import { useClickOutside } from "../lib/useClickOutside.js";
import { IconMore } from "./applications/icons.js";

export interface ActionItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Havola yoki amal — bittasi. */
  href?: string;
  onSelect?: () => void;
  tone?: "danger";
}

/**
 * Kartadagi "⋮" menyu tugmasi (arizalar, saqlanganlar): ochilganda birinchi band
 * fokuslanadi, ↑/↓/Home/End bilan yuriladi, Esc yopadi va fokusni tugmaga qaytaradi.
 */
export function ActionsMenu({ label, items }: { label: string; items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useClickOutside(wrapRef, () => setOpen(false), open);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const nodes = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (index + 1) % nodes.length;
    else if (e.key === "ArrowUp") next = (index - 1 + nodes.length) % nodes.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = nodes.length - 1;
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    } else if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    nodes[next]?.focus();
  };

  const itemClass = (tone?: "danger") =>
    `flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none ${
      tone === "danger" ? "text-danger" : "text-ink"
    }`;

  return (
    <div ref={wrapRef} className={`relative ${open ? "z-30" : ""}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-dusk transition-colors hover:border-signal/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <IconMore size={18} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-30 mt-1.5 w-60 animate-pop overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop"
        >
          {items.map((item) =>
            item.href ? (
              <a key={item.key} role="menuitem" tabIndex={-1} href={item.href} className={itemClass(item.tone)}>
                <span className={item.tone === "danger" ? "" : "text-dusk"}>{item.icon}</span>
                {item.label}
              </a>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  // Dialog/o'zgarishdan keyin fokus menyu tugmasiga qaytsin
                  buttonRef.current?.focus();
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={itemClass(item.tone)}
              >
                <span className={item.tone === "danger" ? "" : "text-dusk"}>{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
