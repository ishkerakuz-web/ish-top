import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import type { EmployerVacancyVM } from "../../../lib/employer/vacancies/adapter.js";
import { VacancyRow } from "./VacancyRow.js";

export function VacancyList({
  items,
  busyId,
  onStatus,
  onDelete,
}: {
  items: EmployerVacancyVM[];
  busyId: string | null;
  onStatus: (vacancy: EmployerVacancyVM, next: "active" | "archived") => void;
  onDelete: (vacancy: EmployerVacancyVM) => void;
}) {
  const p = useT().employerVacanciesPage;
  return (
    // Katta ekranda ustunlar (holat, arizalar, sana, amallar) barcha qatorlarda bir chiziqda — subgrid
    <ul aria-label={p.listLabel} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] xl:gap-x-6" data-testid="vacancies-list">
      {items.map((vacancy) => (
        <VacancyRow key={vacancy.id} vacancy={vacancy} busy={busyId === vacancy.id} onStatus={onStatus} onDelete={onDelete} />
      ))}
    </ul>
  );
}
