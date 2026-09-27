import React, { useCallback, useMemo, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { ImageLightbox } from "./ImageLightbox.js";
import { IconChevronLeft, IconChevronRight, IconImages } from "./icons.js";

/**
 * Yuklanmagan rasmlarni ro'yxatdan chiqarib tashlaydi — buzilgan rasm o'rnida
 * bo'sh quti qolmaydi, layout qolgan rasmlar soniga moslashadi (0 → blok yo'q).
 * SSR'da yuklanib ulgurmay xato bergan rasm ham ref orqali aniqlanadi.
 */
export function useLoadableImages(images: string[]) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const markFailed = useCallback(
    (src: string) => setFailed((prev) => (prev.has(src) ? prev : new Set([...prev, src]))),
    []
  );
  const visible = useMemo(() => images.filter((src) => !failed.has(src)), [images, failed]);
  return { visible, markFailed };
}

export function GalleryPhoto({
  src,
  alt,
  onFail,
  eager = false,
}: {
  src: string;
  alt: string;
  onFail: (src: string) => void;
  eager?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => onFail(src)}
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) onFail(src);
      }}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
    />
  );
}

const TILE =
  "group relative block overflow-hidden rounded-2xl bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const PILL =
  "inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-[13px] font-semibold text-[#0F172A] shadow-card backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/**
 * Ish joyi galereyasi — faqat bazadagi rasmlar bilan:
 * 1 → bitta keng rasm; 2 → ikki ustun; 3 → katta + 2 kichik;
 * 4+ → katta (strelkalar, "1 / N") + 3 kichik + "Barcha rasmlar (N)".
 * Rasm yo'q bo'lsa komponent hech narsa chizmaydi.
 */
export function VacancyGallery({ images, companyName, label }: { images: string[]; companyName: string; label?: string }) {
  const g = useT().vacancyDetail.gallery;
  const { visible, markFailed } = useLoadableImages(images);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const count = visible.length;
  if (count === 0) return null;

  const alt = (i: number) => g.alt(companyName, i + 1);
  const current = Math.min(active, count - 1);

  const tile = (i: number, className: string, eager = false, overlay?: string) => (
    <button type="button" onClick={() => setLightbox(i)} aria-label={g.open(i + 1, count)} className={`${TILE} ${className}`}>
      <GalleryPhoto src={visible[i]} alt={alt(i)} onFail={markFailed} eager={eager} />
      {overlay && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-black/45 font-display text-xl font-bold text-white">
          {overlay}
        </span>
      )}
    </button>
  );

  let body: React.ReactNode;
  if (count === 1) {
    body = tile(0, "aspect-[16/9] w-full", true);
  } else if (count === 2) {
    body = (
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {tile(0, "aspect-[4/3]", true)}
        {tile(1, "aspect-[4/3]", true)}
      </div>
    );
  } else if (count === 3) {
    body = (
      <div className="grid grid-cols-2 gap-2 sm:aspect-[16/8] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:grid-rows-2 sm:gap-3">
        {tile(0, "col-span-2 aspect-[16/10] sm:col-span-1 sm:row-span-2 sm:aspect-auto", true)}
        {tile(1, "aspect-[4/3] sm:aspect-auto")}
        {tile(2, "aspect-[4/3] sm:aspect-auto")}
      </div>
    );
  } else {
    const thumbs = [1, 2, 3];
    body = (
      <div className="grid gap-2 sm:aspect-[16/8] sm:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)] sm:gap-3">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl sm:aspect-auto">
          {tile(current, "absolute inset-0 h-full w-full", true)}
          <button
            type="button"
            onClick={() => setActive((current - 1 + count) % count)}
            aria-label={g.prev}
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <IconChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => setActive((current + 1) % count)}
            aria-label={g.next}
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <IconChevronRight size={22} />
          </button>
          <button type="button" onClick={() => setLightbox(current)} className={`${PILL} absolute bottom-3 left-3 z-10`}>
            <IconImages size={16} />
            {g.all(count)}
          </button>
          <span aria-live="polite" className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/55 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-white">
            {g.counter(current + 1, count)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:grid-rows-3 sm:gap-3">
          {thumbs.map((i, k) => (
            <React.Fragment key={visible[i]}>
              {tile(i, "aspect-[4/3] sm:aspect-auto", false, k === 2 && count > 4 ? `+${count - 4}` : undefined)}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section aria-label={label ?? g.label} className="animate-fade-up">
      {body}
      <ImageLightbox images={visible} index={lightbox} onIndex={setLightbox} onClose={closeLightbox} alt={alt} />
    </section>
  );
}
