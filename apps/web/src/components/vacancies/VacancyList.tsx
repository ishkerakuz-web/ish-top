import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { Vacancy } from "../../lib/types.js";
import { VacancyCard } from "./VacancyCard.js";

export function VacancyList({
  items,
  isSaved,
  onToggleSave,
}: {
  items: Vacancy[];
  /** Berilmasa saqlash tugmalari ko'rsatilmaydi. */
  isSaved?: (id: string) => boolean;
  onToggleSave?: (id: string) => void;
}) {
  const label = useT().vacanciesPage.listLabel;
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {items.map((vacancy) => (
        <li key={vacancy.id}>
          <VacancyCard vacancy={vacancy} saved={isSaved ? isSaved(vacancy.id) : undefined} onToggleSave={onToggleSave} />
        </li>
      ))}
    </ul>
  );
}
