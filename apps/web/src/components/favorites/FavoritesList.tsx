import React from "react";
import type { SavedVacancy } from "../../lib/favorites/adapter.js";
import { useT } from "../../lib/i18n/index.js";
import { ListPagination, type ListPaginationProps } from "../ListPagination.js";
import { FavoriteVacancyCard } from "./FavoriteVacancyCard.js";

export function FavoritesList({ items, onRemove }: { items: SavedVacancy[]; onRemove: (item: SavedVacancy) => void }) {
  const f = useT().favoritesPage;
  return (
    <ul aria-label={f.list.label} className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <FavoriteVacancyCard item={item} onRemove={onRemove} />
        </li>
      ))}
    </ul>
  );
}

/** Saqlanganlar sahifalashi — umumiy `ListPagination` (backend bitta ro'yxat qaytaradi). */
export function FavoritesPagination(props: ListPaginationProps) {
  return <ListPagination labels={useT().favoritesPage.pagination} {...props} />;
}
