import React, { useCallback, useId, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { ImageLightbox } from "./ImageLightbox.js";
import { GalleryPhoto, useLoadableImages } from "./VacancyGallery.js";

const SHOWN = 3;

/**
 * "Kompaniya rasmlari" — 3 ta kichik rasm; ko'proq bo'lsa oxirgisida "+N"
 * va "Barchasi (N)". Rasm bo'lmasa (yoki hammasi yuklanmasa) blok yo'q.
 */
export function CompanyGallery({ images, companyName }: { images: string[]; companyName: string }) {
  const t = useT().vacancyDetail;
  const headingId = useId();
  const { visible, markFailed } = useLoadableImages(images);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const close = useCallback(() => setLightbox(null), []);

  const count = visible.length;
  if (count === 0) return null;
  const alt = (i: number) => t.gallery.alt(companyName, i + 1);

  return (
    <section aria-labelledby={headingId} className="mt-5 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="font-display text-[15px] font-bold text-ink">
          {t.company.gallery}
        </h3>
        {count > SHOWN && (
          <button
            type="button"
            onClick={() => setLightbox(0)}
            className="rounded-md text-[13px] font-semibold text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {t.company.galleryAll(count)}
          </button>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {visible.slice(0, SHOWN).map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setLightbox(i)}
              aria-label={t.gallery.open(i + 1, count)}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <GalleryPhoto src={src} alt={alt(i)} onFail={markFailed} />
              {i === SHOWN - 1 && count > SHOWN && (
                <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-black/45 font-display text-lg font-bold text-white">
                  +{count - SHOWN}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <ImageLightbox images={visible} index={lightbox} onIndex={setLightbox} onClose={close} alt={alt} />
    </section>
  );
}
