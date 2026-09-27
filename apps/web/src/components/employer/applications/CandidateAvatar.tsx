import React, { useEffect, useState } from "react";
import { initials } from "../../../lib/employer/applications/adapter.js";

const SIZES = {
  sm: "h-10 w-10 text-[13px]",
  md: "h-12 w-12 text-[15px]",
  lg: "h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl",
} as const;

/** Nomzod rasmi (profildan). Rasm yo'q yoki yuklanmasa — ism bosh harflari. `dot` — yangi ariza belgisi. */
export function CandidateAvatar({ name, src, size = "md", dot = false }: { name: string; src: string | null; size?: keyof typeof SIZES; dot?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <span className={`relative inline-flex shrink-0 ${SIZES[size]}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full rounded-full border border-line bg-surface-2 object-cover" />
      ) : (
        <span aria-hidden className="flex h-full w-full select-none items-center justify-center rounded-full bg-signal-soft font-display font-bold text-signal dark:text-indigo-300">
          {initials(name)}
        </span>
      )}
      {dot && <span aria-hidden className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-signal ring-2 ring-surface" />}
    </span>
  );
}
