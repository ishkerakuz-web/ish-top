import React, { useCallback, useRef } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { useDialog } from "../../../lib/useDialog.js";
import { IconChevronLeft, IconChevronRight, IconX } from "./icons.js";

/**
 * Rasmlarni katta ko'rish oynasi: ←/→ bilan almashadi, Esc yopadi, fokus
 * ichida aylanadi. Faqat haqiqiy rasmlar ro'yxati bilan ochiladi.
 */
export function ImageLightbox({
  images,
  index,
  onIndex,
  onClose,
  alt,
}: {
  images: string[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  alt: (index: number) => string;
}) {
  const g = useT().vacancyDetail.gallery;
  const panelRef = useRef<HTMLDivElement>(null);
  const open = index !== null && images.length > 0;
  const count = images.length;
  const current = index === null ? 0 : Math.min(index, count - 1);

  const go = useCallback((delta: number) => onIndex((current + delta + count) % count), [current, count, onIndex]);

  useDialog(open, panelRef, onClose, (e) => {
    if (count < 2) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  });

  if (!open) return null;

  const navBtn =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div className="fixed inset-0 z-[60] animate-fade-in bg-black/90">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={g.dialog} tabIndex={-1} className="flex h-full flex-col outline-none">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
          <p aria-live="polite" className="text-sm font-semibold tabular-nums">
            {g.counter(current + 1, count)}
          </p>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={g.close}
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <IconX size={22} />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <img
            key={images[current]}
            src={images[current]}
            alt={alt(current)}
            decoding="async"
            className="max-h-full max-w-full animate-fade-in rounded-xl object-contain"
          />
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={g.prev} className={`${navBtn} left-3 sm:left-5`}>
                <IconChevronLeft size={24} />
              </button>
              <button type="button" onClick={() => go(1)} aria-label={g.next} className={`${navBtn} right-3 sm:right-5`}>
                <IconChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-4 sm:justify-center">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => onIndex(i)}
                aria-label={g.open(i + 1, count)}
                aria-current={i === current || undefined}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  i === current ? "border-white opacity-100" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
