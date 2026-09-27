import React from "react";
import { useT } from "../../lib/i18n/index.js";
import { ActionsMenu, type ActionItem } from "../ActionsMenu.js";
import { IconBriefcase, IconBuilding, IconFile } from "./icons.js";

/** Ariza kartasidagi "⋮": arizani ko'rish, vakansiya (ochiq bo'lsa), kompaniya. */
export function ApplicationActionsMenu({
  title,
  onOpen,
  vacancyHref,
  companyHref,
}: {
  title: string;
  onOpen: () => void;
  /** Vakansiya yopilgan bo'lsa `null` — uning sahifasi 404. */
  vacancyHref: string | null;
  companyHref: string | null;
}) {
  const c = useT().applicationsPage.card;
  const items: ActionItem[] = [{ key: "open", label: c.viewApplication, icon: <IconFile size={16} />, onSelect: onOpen }];
  if (vacancyHref) items.push({ key: "vacancy", label: c.openVacancy, icon: <IconBriefcase size={16} />, href: vacancyHref });
  if (companyHref) items.push({ key: "company", label: c.companyPage, icon: <IconBuilding size={16} />, href: companyHref });
  return <ActionsMenu label={c.actions(title)} items={items} />;
}
