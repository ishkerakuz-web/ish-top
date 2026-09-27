import React, { useCallback, useId, useState } from "react";
import { useT } from "../../../lib/i18n/index.js";
import { VacancyGallery, GalleryPhoto, useLoadableImages } from "../../vacancies/detail/VacancyGallery.js";
import { ImageLightbox } from "../../vacancies/detail/ImageLightbox.js";
import { CARD, CARD_TITLE, LINK_BUTTON } from "./styles.js";
import { IconArrowRight } from "./icons.js";

/**
 * "Kompaniya rasmlari" (asosiy tab) — vakansiya galereyasi bilan bir xil
 * layout: 1 / 2 / 3 / 4+ rasm, lightbox, yuklanmagan rasm chiqarib tashlanadi.
 * Hamma rasm yuklanmasa karta ham yashiriladi (`:has(img)`), rasm yo'q — blok yo'q.
 */
export function CompanyPhotosSection({ images, companyName, onShowAll }: { images: string[]; companyName: string; onShowAll: () => void }) {
  const t = useT();
  const d = t.companyDetail.gallery;
  const headingId = useId();
  if (images.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={`${CARD} [&:not(:has(img))]:hidden`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={headingId} className={CARD_TITLE}>
          {d.title}
        </h2>
        {images.length > 3 && (
          <button type="button" onClick={onShowAll} className={LINK_BUTTON}>
            {/* Son galereyaning o'zida (yuklanmagan rasmlarsiz) — bu yerda takrorlanmaydi */}
            {t.companyDetail.vacancies.all}
            <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
      <VacancyGallery images={images} companyName={companyName} label={d.label} />
    </section>
  );
}

/** "Rasmlar" tabi — barcha rasmlar panjarada, bosilganda lightbox. */
export function CompanyPhotosGrid({ images, companyName }: { images: string[]; companyName: string }) {
  const t = useT();
  const d = t.companyDetail.gallery;
  const g = t.vacancyDetail.gallery;
  const headingId = useId();
  const { visible, markFailed } = useLoadableImages(images);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const close = useCallback(() => setLightbox(null), []);
  if (visible.length === 0) return null;
  const alt = (i: number) => g.alt(companyName, i + 1);

  return (
    <section aria-labelledby={headingId} className={CARD}>
      <h2 id={headingId} className={CARD_TITLE}>
        {d.title}
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {visible.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setLightbox(i)}
              aria-label={g.open(i + 1, visible.length)}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <GalleryPhoto src={src} alt={alt(i)} onFail={markFailed} eager={i < 3} />
            </button>
          </li>
        ))}
      </ul>
      <ImageLightbox images={visible} index={lightbox} onIndex={setLightbox} onClose={close} alt={alt} />
    </section>
  );
}
