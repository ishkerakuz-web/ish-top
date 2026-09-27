import { useMemo } from "react";
import { useLocale, useT } from "../../../../lib/i18n/index.js";
import { regionName } from "../../../../lib/i18n/regions.js";
import { CATEGORY_NAMES } from "../../../../lib/i18n/categories.js";
import { formatSalary } from "../../../../lib/format.js";
import { parseSalary, type VacancyFormValues } from "../../../../lib/employer/vacancies/form.js";
import type { Category, Region } from "../../../../lib/types.js";

/** Preview va "Ko'rib chiqish" uchun formadagi haqiqiy qiymatlar yozuvi; bo'shi — `null`. */
export interface VacancySummary {
  title: string;
  region: string | null;
  category: string | null;
  /** "Ofisda" / "Gibrid" / "Masofaviy". */
  workplace: string | null;
  employment: string | null;
  schedule: string | null;
  experience: string | null;
  /** Maosh kiritilgan va yashirilmagan bo'lsa. */
  salary: string | null;
  salaryHidden: boolean;
}

export function categoryLabel(category: Category, locale: keyof typeof CATEGORY_NAMES): string {
  return (category.slug && CATEGORY_NAMES[locale]?.[category.slug]) || category.name;
}

export function useVacancySummary(values: VacancyFormValues, categories: Category[], regions: Region[]): VacancySummary {
  const t = useT();
  const { locale } = useLocale();
  return useMemo(() => {
    const region = regions.find((r) => r.id === values.regionId);
    const category = categories.find((c) => c.id === values.categoryId);
    const min = parseSalary(values.salaryMin);
    const max = parseSalary(values.salaryMax);
    const minValue = typeof min === "number" ? min : null;
    const maxValue = typeof max === "number" ? max : null;
    return {
      title: values.title.trim(),
      // Masofaviy ishda hudud yuborilmaydi — preview'da ham yo'q
      region: region && values.workplaceType !== "remote" ? regionName(locale, region.slug, region.name) : null,
      category: category ? categoryLabel(category, locale) : null,
      workplace: values.workplaceType ? t.enums.workplace[values.workplaceType] : null,
      employment: values.employmentType ? t.enums.employment[values.employmentType] : null,
      schedule: values.scheduleType ? t.vacanciesPage.schedule[values.scheduleType] : null,
      experience: t.enums.experience[values.experienceRequired] ?? null,
      salary: !values.isSalaryHidden && (minValue || maxValue) ? formatSalary(minValue, maxValue, t.fmt) : null,
      salaryHidden: values.isSalaryHidden,
    };
  }, [values, categories, regions, locale, t]);
}
