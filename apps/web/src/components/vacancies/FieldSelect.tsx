import React from "react";
import { IconChevronDown } from "./icons.js";

export interface FieldOption {
  value: string;
  label: string;
  /** Ro'yxatda ko'rinmaydi, lekin tanlangan qiymat sifatida yozuvi chiqadi ("3 ta tanlangan"). */
  hidden?: boolean;
}

const SIZES = {
  lg: "h-12 rounded-2xl text-[14.5px] shadow-card sm:h-14",
  md: "h-11 rounded-xl text-[14px]",
  sm: "h-10 rounded-xl text-[13.5px]",
} as const;

/**
 * Oddiy `<select>` brend uslubida: klaviatura, ekran o'quvchi va telefonning
 * o'z tanlagichi o'z-o'zidan ishlaydi (maxsus dropdown'dan ishonchliroq).
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
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/* Telefonda ikonka yashirin — tor ustunda yozuv qirqilmasin */}
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 hidden -translate-y-1/2 text-dusk sm:block">{icon}</span>}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full cursor-pointer appearance-none truncate border border-line bg-surface pr-9 text-ink transition-colors hover:border-signal/40 focus:border-signal focus:outline-none focus:ring-4 focus:ring-signal/10 dark:[color-scheme:dark] ${
          icon ? "pl-3.5 sm:pl-10" : "pl-3.5"
        } ${value ? "font-medium" : ""} ${SIZES[size]}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} hidden={o.hidden}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dusk" />
    </div>
  );
}
