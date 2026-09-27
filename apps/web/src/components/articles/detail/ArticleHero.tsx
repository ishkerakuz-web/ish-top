import React, { useState } from "react";

/** Muqova — faqat mavjud va yuklangan bo'lsa; aks holda umuman joy egallamaydi. */
export function ArticleHero({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <figure className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface-2" data-testid="article-hero">
      <img src={src} alt="" width={1200} height={675} decoding="async" onError={() => setOk(false)} className="aspect-[16/9] w-full object-cover" />
    </figure>
  );
}
