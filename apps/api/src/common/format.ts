export function formatSalaryLabel(min?: number | null, max?: number | null, currency = "UZS") {
  const cur = currency === "UZS" ? "so'm" : currency;
  const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
  if (!min && !max) return "Maosh ko'rsatilmagan";
  if (min && max) return `${fmt(min)} – ${fmt(max)} ${cur}`;
  if (min) return `${fmt(min)} ${cur} dan`;
  return `${fmt(max!)} ${cur} gacha`;
}
