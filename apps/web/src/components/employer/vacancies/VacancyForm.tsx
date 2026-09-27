import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHref, useLocale, useT } from "../../../lib/i18n/index.js";
import { regionName } from "../../../lib/i18n/regions.js";
import { ApiError, createVacancy, updateVacancy } from "../../../lib/api.js";
import { isPhoneGateError } from "../../PhoneGateNotice.js";
import type { EmployerCompanySummary } from "../../../lib/employer/vacancies/api.js";
import { useLeaveGuard } from "../../../lib/employer/vacancies/useLeaveGuard.js";
import {
  DESCRIPTION_MIN,
  EXPERIENCE_LEVELS,
  FORM_SECTIONS,
  PHONE_MAX,
  SCHEDULE_TYPES,
  SECTION_FIELDS,
  TELEGRAM_MAX,
  TITLE_MIN,
  emptyVacancyForm,
  employmentChoices,
  excerpt,
  isRegionRequired,
  fieldId,
  firstErrorField,
  formFromVacancy,
  isFormDirty,
  listItemCount,
  sectionHasErrors,
  sectionId,
  toVacancyPayload,
  validateVacancyForm,
  type FormSectionKey,
  type VacancyErrorCode,
  type VacancyFieldKey,
  type VacancyFormValues,
} from "../../../lib/employer/vacancies/form.js";
import type { Category, EmployerVacancy, Region } from "../../../lib/types.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { CheckboxField, Field, FieldMessage, SectionCard, SelectInput, TextArea, TextInput, describedBy } from "./form/FormControls.js";
import { DescriptionEditor } from "./form/DescriptionEditor.js";
import { FormSteps, STEP_ORDER, type StepKey } from "./form/FormSteps.js";
import { FormActions, FormTips, VacancyPreviewCard, type SaveFailure, type SavingIntent } from "./form/FormSidebar.js";
import { VacancyReview } from "./form/VacancyReview.js";
import { WorkplaceField } from "./form/WorkplaceField.js";
import { categoryLabel, useVacancySummary } from "./form/useVacancySummary.js";
import { IconBriefcase, IconClipboardCheck, IconFile, IconShield, IconSpark } from "./icons.js";

type Pending = { focus: VacancyFieldKey } | { section: FormSectionKey } | { review: true } | { top: true };

const sectionOf = (field: VacancyFieldKey): FormSectionKey => FORM_SECTIONS.find((s) => SECTION_FIELDS[s].includes(field)) ?? "basic";
const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * Vakansiya formasi — yaratish va tahrirlash. Bitta sahifa: 3 bo'lim (bosqichlar
 * indikatori scroll bo'yicha) + "Ko'rib chiqish" holati. Saqlash: mavjud
 * `POST /api/vacancies` (`status: "draft"` — qoralama) va `PUT /api/vacancies/:id`.
 */
export function VacancyForm({
  token,
  categories,
  regions,
  company,
  vacancy,
  listHref,
}: {
  token: string;
  categories: Category[];
  regions: Region[];
  company: EmployerCompanySummary;
  /** Berilgan bo'lsa — tahrirlash. */
  vacancy: EmployerVacancy | null;
  listHref: string;
}) {
  const t = useT();
  const f = t.vacancyForm;
  const fl = f.fields;
  const s = f.sections;
  const { locale } = useLocale();
  const l = useHref();
  const mode = vacancy ? "edit" : "new";

  const initial = useMemo<VacancyFormValues>(() => (vacancy ? formFromVacancy(vacancy) : emptyVacancyForm()), [vacancy]);
  const [values, setValues] = useState<VacancyFormValues>(initial);
  const [touched, setTouched] = useState<Partial<Record<VacancyFieldKey, true>>>({});
  const [attempted, setAttempted] = useState(false);
  const [review, setReview] = useState(false);
  const [active, setActive] = useState<FormSectionKey>("basic");
  const [saving, setSaving] = useState<SavingIntent | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [gated, setGated] = useState(false);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const lastIntent = useRef<SavingIntent>("publish");
  const topRef = useRef<HTMLDivElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);

  const errors = useMemo(() => validateVacancyForm(values), [values]);
  const dirty = isFormDirty(initial, values);
  // Saqlanmagan o'zgarish bo'lsa sayt ichidagi har qanday havola (navbar, breadcrumb, footer) — tasdiq oynasi
  const { allowLeave } = useLeaveGuard(dirty, setLeaveHref);
  const summary = useVacancySummary(values, categories, regions);
  const descriptionExcerpt = useMemo(() => excerpt(values.description), [values.description]);

  const message = (code: VacancyErrorCode): string => {
    switch (code) {
      case "titleShort":
        return f.errors.titleShort(TITLE_MIN);
      case "descriptionShort":
        return f.errors.descriptionShort(DESCRIPTION_MIN);
      case "telegramLong":
        return f.errors.telegramLong(TELEGRAM_MAX);
      case "phoneLong":
        return f.errors.phoneLong(PHONE_MAX);
      default:
        return f.errors[code];
    }
  };
  const errorFor = (key: VacancyFieldKey): string | null => {
    const code = errors[key];
    return code && (attempted || touched[key]) ? message(code) : null;
  };

  const set = <K extends VacancyFieldKey>(key: K, value: VacancyFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFailure(null);
  };
  const touch = (key: VacancyFieldKey) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  // Backend xabari "maydon: matn" ko'rinishida — texnik nom o'rniga forma yorlig'i
  const FIELD_LABELS: Partial<Record<string, string>> = {
    title: fl.title,
    description: fl.description,
    categoryId: fl.category,
    regionId: fl.region,
    workplaceType: fl.workplace,
    employmentType: fl.employment,
    contactEmail: fl.email,
    contactTelegram: fl.telegram,
    contactPhone: fl.phone,
  };
  const readableServerMessage = (text: string) => {
    const match = /^(\w+):\s*(.+)$/.exec(text);
    const label = match ? FIELD_LABELS[match[1]] : undefined;
    return match && label ? `${label} — ${match[2]}` : text;
  };

  // Joriy bo'lim — ekranning yuqori qismidagi karta (bosqichlar indikatori uchun)
  useEffect(() => {
    if (review || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = FORM_SECTIONS.find((key) => visible.has(sectionId(key)));
        if (first) setActive(first);
      },
      { rootMargin: "-22% 0px -55% 0px" }
    );
    for (const key of FORM_SECTIONS) {
      const el = document.getElementById(sectionId(key));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [review]);

  // Holat almashgach (forma ↔ ko'rib chiqish) scroll va fokus
  useEffect(() => {
    if (!pending) return;
    const behavior = scrollBehavior();
    if ("focus" in pending) {
      const el = document.getElementById(fieldId(pending.focus));
      el?.scrollIntoView({ behavior, block: "center" });
      el?.focus({ preventScroll: true });
    } else if ("section" in pending) {
      document.getElementById(sectionId(pending.section))?.scrollIntoView({ behavior, block: "start" });
    } else {
      topRef.current?.scrollIntoView({ behavior, block: "start" });
      if ("review" in pending) reviewHeadingRef.current?.focus({ preventScroll: true });
    }
    setPending(null);
  }, [pending, review]);

  const showFirstError = (): boolean => {
    setAttempted(true);
    const first = firstErrorField(errors);
    if (!first) return false;
    setReview(false);
    setActive(sectionOf(first));
    setPending({ focus: first });
    return true;
  };

  const openReview = () => {
    if (saving || showFirstError()) return;
    setFailure(null);
    setReview(true);
    setPending({ review: true });
  };

  const selectStep = (step: StepKey) => {
    if (step === "review") return openReview();
    setReview(false);
    setActive(step);
    setPending({ section: step });
  };

  async function save(intent: SavingIntent) {
    if (saving) return;
    lastIntent.current = intent;
    if (showFirstError()) return;
    setSaving(intent);
    setFailure(null);
    setGated(false);
    try {
      const payload = toVacancyPayload(values, mode);
      let createdStatus: string | undefined;
      if (vacancy) await updateVacancy(token, vacancy.id, payload);
      else createdStatus = (await createVacancy(token, { ...payload, status: intent === "draft" ? "draft" : "active" }))?.status;
      allowLeave();
      // Tasdiqlanmagan kompaniya e'loni oldindan moderatsiyaga tushadi — "e'lon qilindi" deyilmaydi
      const notice =
        mode === "edit" ? "updated" : intent === "draft" ? "draft" : createdStatus === "moderation" ? "submitted" : "created";
      window.location.assign(l(`/employer/vacancies?notice=${notice}`));
    } catch (err) {
      setSaving(null);
      if (isPhoneGateError(err)) return setGated(true);
      // Backend rad etdi (validatsiya, kompaniya yo'q...) — uning xabari; tarmoq/server xatosi — qayta urinish
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        return setFailure({ message: f.errors.server(readableServerMessage(err.message)), retry: false });
      }
      setFailure({ message: null, retry: true });
    }
  }

  const cancel = () => {
    if (dirty) setLeaveHref(listHref);
    else window.location.assign(listHref);
  };
  const confirmLeave = () => {
    const href = leaveHref;
    allowLeave();
    setLeaveHref(null);
    if (href) window.location.assign(href);
  };

  // Bosqichlar: oldingi va to'g'ri to'ldirilgan — ✓; urinishdan keyin xatoli — qizil
  const current: StepKey = review ? "review" : active;
  const currentIndex = STEP_ORDER.indexOf(current);
  const done = {} as Record<StepKey, boolean>;
  const invalid = {} as Record<StepKey, boolean>;
  STEP_ORDER.forEach((step, i) => {
    const hasErrors = step !== "review" && sectionHasErrors(step, errors);
    done[step] = step !== "review" && i < currentIndex && !hasErrors;
    invalid[step] = attempted && hasErrors;
  });
  const errorCount = attempted ? Object.keys(errors).length : 0;

  const categoryOptions = categories.map((c) => ({ value: c.id, label: categoryLabel(c, locale) }));
  const regionOptions = regions.map((r) => ({ value: r.id, label: regionName(locale, r.slug, r.name) }));
  const employmentOptions = employmentChoices(initial.employmentType).map((k) => ({ value: k, label: t.enums.employment[k] }));
  const regionNeeded = isRegionRequired(values.workplaceType);
  const scheduleOptions = SCHEDULE_TYPES.map((k) => ({ value: k, label: t.vacanciesPage.schedule[k] }));
  const experienceOptions = EXPERIENCE_LEVELS.map((k) => ({ value: k, label: t.enums.experience[k] }));

  const requirementsCount = listItemCount(values.requirements);
  const conditionsCount = listItemCount(values.conditions);
  const listHint = (count: number) => (count > 0 ? `${fl.listHint} ${fl.itemCount(count)}` : fl.listHint);

  const titleError = errorFor("title");
  const employmentError = errorFor("employmentType");
  const categoryError = errorFor("categoryId");
  const workplaceError = errorFor("workplaceType");
  const regionError = errorFor("regionId");
  const salaryMinError = errorFor("salaryMin");
  const salaryMaxError = errorFor("salaryMax");
  const descriptionError = errorFor("description");
  const emailError = errorFor("contactEmail");
  const telegramError = errorFor("contactTelegram");
  const phoneError = errorFor("contactPhone");

  return (
    <>
      <div ref={topRef} className="mt-6 grid scroll-mt-28 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <FormSteps current={current} done={done} invalid={invalid} onSelect={selectStep} />

          {review ? (
            <VacancyReview mode={mode} values={values} summary={summary} company={company} headingRef={reviewHeadingRef} onEdit={() => selectStep("basic")} />
          ) : (
            <form
              data-testid="vacancy-form"
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault();
                openReview();
              }}
              className="space-y-5"
            >
              <SectionCard id={sectionId("basic")} icon={<IconBriefcase size={20} />} title={s.basic.title} subtitle={s.basic.subtitle}>
                <div className="grid gap-4 md:grid-cols-6">
                  <Field id={fieldId("title")} label={fl.title} required error={titleError} className="md:col-span-6">
                    <TextInput
                      id={fieldId("title")}
                      value={values.title}
                      onChange={(ev) => set("title", ev.target.value)}
                      onBlur={() => touch("title")}
                      placeholder={fl.titlePlaceholder}
                      autoComplete="off"
                      invalid={Boolean(titleError)}
                      aria-describedby={describedBy(fieldId("title"), { error: titleError })}
                    />
                  </Field>
                  <Field id={fieldId("categoryId")} label={fl.category} required error={categoryError} className="md:col-span-3">
                    <SelectInput
                      id={fieldId("categoryId")}
                      value={values.categoryId}
                      options={categoryOptions}
                      placeholder={fl.categoryPlaceholder}
                      placeholderSelectable={false}
                      invalid={Boolean(categoryError)}
                      aria-describedby={describedBy(fieldId("categoryId"), { error: categoryError })}
                      onChange={(v) => set("categoryId", v)}
                      onBlur={() => touch("categoryId")}
                    />
                  </Field>
                  <Field id={fieldId("employmentType")} label={fl.employment} required error={employmentError} className="md:col-span-3">
                    <SelectInput
                      id={fieldId("employmentType")}
                      value={values.employmentType}
                      options={employmentOptions}
                      placeholder={fl.employmentPlaceholder}
                      placeholderSelectable={false}
                      invalid={Boolean(employmentError)}
                      aria-describedby={describedBy(fieldId("employmentType"), { error: employmentError })}
                      onChange={(v) => set("employmentType", v as VacancyFormValues["employmentType"])}
                      onBlur={() => touch("employmentType")}
                    />
                  </Field>
                  <WorkplaceField
                    id={fieldId("workplaceType")}
                    value={values.workplaceType}
                    onChange={(v) => {
                      set("workplaceType", v);
                      touch("workplaceType");
                    }}
                    error={workplaceError}
                    hint={values.workplaceType === "remote" ? fl.workplaceRemoteHint : null}
                    className="md:col-span-6"
                  />
                  {/* Masofaviy ishda hudud IXTIYORIY (audit R3, employer-flows-17): maydon ko'rinadi,
                      tanlangani saqlanadi — ilgari u yashirilib, tahrirlashda bazadagi hudud o'chib ketardi */}
                  <Field id={fieldId("regionId")} label={fl.region} required={regionNeeded} error={regionError} className="md:col-span-2">
                    <SelectInput
                      id={fieldId("regionId")}
                      value={values.regionId}
                      options={regionOptions}
                      placeholder={fl.regionPlaceholder}
                      placeholderSelectable={!regionNeeded}
                      invalid={Boolean(regionError)}
                      aria-describedby={describedBy(fieldId("regionId"), { error: regionError })}
                      onChange={(v) => set("regionId", v)}
                      onBlur={() => touch("regionId")}
                    />
                  </Field>
                  <Field id={fieldId("scheduleType")} label={fl.schedule} className="md:col-span-2">
                    <SelectInput
                      id={fieldId("scheduleType")}
                      value={values.scheduleType}
                      options={scheduleOptions}
                      placeholder={fl.schedulePlaceholder}
                      onChange={(v) => set("scheduleType", v as VacancyFormValues["scheduleType"])}
                    />
                  </Field>
                  <Field id={fieldId("experienceRequired")} label={fl.experience} className="md:col-span-2">
                    <SelectInput
                      id={fieldId("experienceRequired")}
                      value={values.experienceRequired}
                      options={experienceOptions}
                      onChange={(v) => set("experienceRequired", v as VacancyFormValues["experienceRequired"])}
                    />
                  </Field>

                  <fieldset className="min-w-0 md:col-span-6" data-field="salary">
                    <legend className="text-[13.5px] font-medium text-ink">
                      {fl.salary} <span className="text-[13px] font-normal text-dusk">({f.optional})</span>
                    </legend>
                    <div className="mt-1.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
                      <div className="min-w-0">
                        <label htmlFor={fieldId("salaryMin")} className="sr-only">
                          {`${fl.salary}: ${fl.salaryFrom}`}
                        </label>
                        <TextInput
                          id={fieldId("salaryMin")}
                          value={values.salaryMin}
                          onChange={(ev) => set("salaryMin", ev.target.value.replace(/\D/g, "").slice(0, 10))}
                          onBlur={() => touch("salaryMin")}
                          placeholder={fl.salaryFrom}
                          inputMode="numeric"
                          autoComplete="off"
                          suffix={fl.currency}
                          invalid={Boolean(salaryMinError)}
                          aria-describedby={describedBy(fieldId("salaryMin"), { error: salaryMinError })}
                        />
                        <FieldMessage id={fieldId("salaryMin")} error={salaryMinError} />
                      </div>
                      <div className="min-w-0">
                        <label htmlFor={fieldId("salaryMax")} className="sr-only">
                          {`${fl.salary}: ${fl.salaryTo}`}
                        </label>
                        <TextInput
                          id={fieldId("salaryMax")}
                          value={values.salaryMax}
                          onChange={(ev) => set("salaryMax", ev.target.value.replace(/\D/g, "").slice(0, 10))}
                          onBlur={() => touch("salaryMax")}
                          placeholder={fl.salaryTo}
                          inputMode="numeric"
                          autoComplete="off"
                          suffix={fl.currency}
                          invalid={Boolean(salaryMaxError)}
                          aria-describedby={describedBy(fieldId("salaryMax"), { error: salaryMaxError })}
                        />
                        <FieldMessage id={fieldId("salaryMax")} error={salaryMaxError} />
                      </div>
                      <CheckboxField
                        id={fieldId("isSalaryHidden")}
                        checked={values.isSalaryHidden}
                        onChange={(checked) => set("isSalaryHidden", checked)}
                        label={fl.salaryHidden}
                        hint={fl.salaryHiddenHint}
                        className="self-start sm:col-span-2 lg:col-span-1"
                      />
                    </div>
                  </fieldset>
                </div>
              </SectionCard>

              <div id={sectionId("details")} className="scroll-mt-28 space-y-5">
                <SectionCard icon={<IconFile size={20} />} title={s.description.title} subtitle={s.description.subtitle}>
                  <Field id={fieldId("description")} label={fl.description} required error={descriptionError}>
                    <DescriptionEditor
                      id={fieldId("description")}
                      value={values.description}
                      onChange={(v) => set("description", v)}
                      onBlur={() => touch("description")}
                      placeholder={fl.descriptionPlaceholder}
                      min={DESCRIPTION_MIN}
                      invalid={Boolean(descriptionError)}
                      errorId={descriptionError ? `${fieldId("description")}-error` : undefined}
                    />
                  </Field>
                </SectionCard>

                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard icon={<IconClipboardCheck size={20} />} title={s.requirements.title} subtitle={s.requirements.subtitle}>
                    <Field id={fieldId("requirements")} label={fl.requirements} hint={listHint(requirementsCount)}>
                      <TextArea
                        id={fieldId("requirements")}
                        value={values.requirements}
                        onChange={(ev) => set("requirements", ev.target.value)}
                        placeholder={fl.requirementsPlaceholder}
                        rows={6}
                        aria-describedby={`${fieldId("requirements")}-hint`}
                      />
                    </Field>
                  </SectionCard>
                  <SectionCard icon={<IconSpark size={20} />} title={s.conditions.title} subtitle={s.conditions.subtitle}>
                    <Field id={fieldId("conditions")} label={fl.conditions} hint={listHint(conditionsCount)}>
                      <TextArea
                        id={fieldId("conditions")}
                        value={values.conditions}
                        onChange={(ev) => set("conditions", ev.target.value)}
                        placeholder={fl.conditionsPlaceholder}
                        rows={6}
                        aria-describedby={`${fieldId("conditions")}-hint`}
                      />
                    </Field>
                  </SectionCard>
                </div>
              </div>

              <SectionCard id={sectionId("extra")} icon={<IconShield size={20} />} title={s.extra.title} subtitle={s.extra.subtitle}>
                <CheckboxField
                  id={fieldId("applyWithoutResume")}
                  checked={values.applyWithoutResume}
                  onChange={(checked) => set("applyWithoutResume", checked)}
                  label={fl.applyWithoutResume}
                  hint={fl.applyWithoutResumeHint}
                />
                <div role="group" aria-labelledby="vf-contacts-title" className="mt-5 border-t border-line pt-5">
                  <h3 id="vf-contacts-title" className="text-[14px] font-semibold text-ink">
                    {s.contacts.title}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-dusk">{s.contacts.subtitle}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field id={fieldId("contactEmail")} label={fl.email} error={emailError}>
                      <TextInput
                        id={fieldId("contactEmail")}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={values.contactEmail}
                        onChange={(ev) => set("contactEmail", ev.target.value)}
                        onBlur={() => touch("contactEmail")}
                        placeholder={fl.emailPlaceholder}
                        invalid={Boolean(emailError)}
                        aria-describedby={describedBy(fieldId("contactEmail"), { error: emailError })}
                      />
                    </Field>
                    <Field id={fieldId("contactTelegram")} label={fl.telegram} error={telegramError}>
                      <TextInput
                        id={fieldId("contactTelegram")}
                        autoComplete="off"
                        value={values.contactTelegram}
                        onChange={(ev) => set("contactTelegram", ev.target.value)}
                        onBlur={() => touch("contactTelegram")}
                        placeholder={fl.telegramPlaceholder}
                        invalid={Boolean(telegramError)}
                        aria-describedby={describedBy(fieldId("contactTelegram"), { error: telegramError })}
                      />
                    </Field>
                    <Field id={fieldId("contactPhone")} label={fl.phone} error={phoneError}>
                      <TextInput
                        id={fieldId("contactPhone")}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={values.contactPhone}
                        onChange={(ev) => set("contactPhone", ev.target.value)}
                        onBlur={() => touch("contactPhone")}
                        placeholder={fl.phonePlaceholder}
                        invalid={Boolean(phoneError)}
                        aria-describedby={describedBy(fieldId("contactPhone"), { error: phoneError })}
                      />
                    </Field>
                  </div>
                </div>
              </SectionCard>
            </form>
          )}
        </div>

        <div className="min-w-0">
          <div className="grid gap-5 md:grid-cols-2 xl:flex xl:h-full xl:flex-col">
            <FormTips />
            <div className="contents xl:sticky xl:top-24 xl:flex xl:max-h-[calc(100vh-7rem)] xl:flex-col xl:gap-5 xl:overflow-y-auto xl:px-1 xl:-mx-1 xl:pb-1">
              <VacancyPreviewCard summary={summary} description={descriptionExcerpt} company={company} onOpen={openReview} />
              <div className="md:col-span-2">
                <FormActions
                  mode={mode}
                  review={review}
                  saving={saving}
                  errorCount={errorCount}
                  failure={failure}
                  gated={gated}
                  onReview={openReview}
                  onPublish={() => void save("publish")}
                  onDraft={() => void save("draft")}
                  onBack={() => {
                    setReview(false);
                    setPending({ top: true });
                  }}
                  onCancel={cancel}
                  onRetry={() => void save(lastIntent.current)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={leaveHref !== null}
        icon="alert"
        title={f.leave.title}
        text={f.leave.text}
        confirmLabel={f.leave.confirm}
        cancelLabel={f.leave.cancel}
        busy={false}
        onConfirm={confirmLeave}
        onCancel={() => setLeaveHref(null)}
      />
    </>
  );
}
