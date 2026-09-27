import React from "react";
import { useT } from "../../lib/i18n/index.js";
import type { MyApplication } from "../../lib/types.js";
import { ListPagination, type ListPaginationProps } from "../ListPagination.js";
import { ApplicationCard } from "./ApplicationCard.js";

export function ApplicationList({ items, onOpen }: { items: MyApplication[]; onOpen: (id: string) => void }) {
  const a = useT().applicationsPage;
  return (
    <ul aria-label={a.list.label} className="space-y-3">
      {items.map((app) => (
        <li key={app.id}>
          <ApplicationCard app={app} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

/** Arizalar sahifalashi — umumiy `ListPagination` (backend bitta ro'yxat qaytaradi). */
export function ApplicationsPagination(props: ListPaginationProps) {
  return <ListPagination labels={useT().applicationsPage.pagination} {...props} />;
}
