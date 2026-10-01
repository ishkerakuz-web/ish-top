import React from "react";
import { Select, type SelectOption, type SelectSize } from "../Select.js";

export type FieldOption = SelectOption;

/**
 * Filtr/saralash maydonlari uchun tanlagich.
 *
 * Ilgari bu oddiy `<select>` edi va brauzerning o'z ro'yxatini chiqarardi —
 * mavzuga bo'ysunmaydigan kulrang to'rtburchak, saytning qolgan qismidan
 * ajralib turardi. Endi ichida umumiy `Select` ishlaydi: bir xil ko'rinish,
 * uzun ro'yxatlarda qidiruv, qisqalarida harf bo'yicha sakrash.
 *
 * Tashqi yuzasi ataylab o'zgarmadi — 11 ta chaqiruv joyi tegilmasdan yangilandi.
 */
export function FieldSelect({
  id,
  label,
  value,
  options,
  onChange,
  icon,
  size = "lg",
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  options: FieldOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  size?: SelectSize;
  className?: string;
}) {
  return (
    <Select
      id={id}
      ariaLabel={label}
      value={value}
      onChange={onChange}
      options={options}
      icon={icon}
      variant="field"
      size={size}
      className={className}
    />
  );
}
