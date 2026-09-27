import React from "react";
import { useT } from "../../lib/i18n/index.js";

/**
 * Moderatsiya navbatidagi yozuvning avto-tasdiq holati:
 * - `autoApproveAt` — navbatda, shuncha vaqtdan keyin avtomatik tasdiqlanadi;
 * - `autoApprovedAt` — admin ko'rmasdan tasdiqlangan ("Tekshirildi" bosilguncha belgili).
 */
export function ModerationBadge({
  autoApproveAt,
  autoApprovedAt,
}: {
  autoApproveAt?: string | null;
  autoApprovedAt?: string | null;
}) {
  const m = useT().admin.moderation;

  if (autoApprovedAt) {
    return (
      <span
        title={`${m.autoApprovedHint} · ${new Date(autoApprovedAt).toLocaleString()}`}
        className="mt-1 inline-block rounded-md bg-signal/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-signal"
      >
        {m.autoApproved}
      </span>
    );
  }

  if (!autoApproveAt) return null;
  const leftMs = new Date(autoApproveAt).getTime() - Date.now();
  let text = m.autoApproveDue;
  if (leftMs > 0) {
    const totalMin = Math.ceil(leftMs / 60_000);
    text = m.autoApproveIn(m.duration(Math.floor(totalMin / 60), totalMin % 60));
  }
  return (
    <span title={new Date(autoApproveAt).toLocaleString()} className="mt-1 block text-xs text-dusk">
      ⏱ {text}
    </span>
  );
}
