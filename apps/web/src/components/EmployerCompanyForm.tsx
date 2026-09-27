import React, { useId, useRef, useState } from "react";
import { saveMyCompany, uploadCompanyLogo, deleteCompanyLogo, absoluteUploadUrl } from "../lib/api.js";
import { apiErrorText } from "../lib/apiExtra.js";
import type { MyCompany, Region } from "../lib/types.js";
import { useT, useLocale, useHref } from "../lib/i18n/index.js";
import { regionName } from "../lib/i18n/regions.js";
import { Select } from "./Select.js";

const EMPLOYEE_RANGES = ["1–10", "11–50", "51–100", "101–500", "500+"];
// API faqat PNG, JPG va WebP logotipni qabul qiladi (audit R3, employer-flows-19)
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

export function EmployerCompanyForm({
  token,
  regions,
  initial,
}: {
  token: string;
  regions: Region[];
  initial: MyCompany | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const l = useHref();
  const states = t.profileHub.states;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [regionId, setRegionId] = useState(initial?.regionId ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [employeeCount, setEmployeeCount] = useState(initial?.employeeCount ?? "");
  const [foundedYear, setFoundedYear] = useState(initial?.foundedYear ? String(initial.foundedYear) : "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const hasCompany = Boolean(initial || slug);

  /** Audit R3, i18n-3: xom server matni ru/en interfeysda ko'rsatilmaydi. */
  const message = (err: unknown) =>
    apiErrorText(err, locale, { fallback: states.saveError, network: states.loadErrorHint });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // bir xil faylni qayta tanlash ham ishlasin
    if (!file) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      const url = await uploadCompanyLogo(token, file);
      setLogoUrl(url);
    } catch (err) {
      setLogoError(message(err));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    setLogoError(null);
    try {
      await deleteCompanyLogo(token);
      setLogoUrl(null);
    } catch (err) {
      setLogoError(message(err));
    } finally {
      setLogoBusy(false);
    }
  }

  const regionOptions = [
    { value: "", label: t.employerProfile.regionPlaceholder },
    ...regions.map((r) => ({ value: r.id, label: regionName(locale, r.slug, r.name) })),
  ];
  const employeeOptions = [
    { value: "", label: "—" },
    ...EMPLOYEE_RANGES.map((r) => ({ value: r, label: r })),
  ];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Audit R3, gap5-5: tugma "o'lik" emas — sabab maydon yonida aytiladi va fokus o'sha yerga boradi
    if (!name.trim()) {
      setNameError(states.required);
      setError(null);
      setSaved(false);
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const company = await saveMyCompany(token, {
        name: name.trim(),
        description: description.trim() || null,
        website: website.trim() || null,
        regionId: regionId || null,
        industry: industry.trim() || null,
        employeeCount: employeeCount || null,
        foundedYear: foundedYear ? Number(foundedYear) : null,
      });
      setSlug(company.slug);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} noValidate className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-7">
      {!initial && (
        <div className="mb-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink">
          {t.employerProfile.createHint}
        </div>
      )}

      {/* Kompaniya logosi */}
      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2">
          {logoUrl ? (
            <img
              src={absoluteUploadUrl(logoUrl)}
              alt={t.employerProfile.logo}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-display text-2xl font-bold text-dusk">
              {(name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{t.employerProfile.logo}</p>
          {hasCompany ? (
            <>
              <p className="mt-0.5 text-xs text-dusk">{t.employerProfile.logoHint}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={logoBusy}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                >
                  {logoBusy ? t.employerProfile.logoUploading : t.employerProfile.logoUpload}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    disabled={logoBusy}
                    onClick={handleLogoRemove}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-dusk transition-colors hover:text-signal disabled:opacity-60"
                  >
                    {t.employerProfile.logoRemove}
                  </button>
                )}
              </div>
              {/* Logotip xatosi tugmalar yonida — formaning eng pastida emas (audit R3, gap5-5) */}
              {logoError && (
                <p role="alert" className="mt-2 text-xs font-medium text-danger">
                  {logoError}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_ACCEPT}
                onChange={handleLogoChange}
                className="hidden"
              />
            </>
          ) : (
            <p className="mt-0.5 text-xs text-dusk">{t.employerProfile.logoSaveFirst}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={nameId} className="text-sm font-medium text-ink">
            {t.employerProfile.name}
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
            <span className="sr-only"> ({states.required})</span>
          </label>
          <input
            id={nameId}
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError(null);
            }}
            placeholder={t.employerProfile.namePlaceholder}
            aria-required="true"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            maxLength={120}
            className={`mt-1.5 w-full rounded-xl border bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-dusk focus:bg-surface focus:outline-none focus:ring-4 ${
              nameError
                ? "border-danger focus:border-danger focus:ring-danger/10"
                : "border-line focus:border-signal focus:ring-signal/10"
            }`}
          />
          {nameError && (
            <p id={`${nameId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {nameError}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Labeled label={t.employerProfile.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.employerProfile.descriptionPlaceholder}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-dusk focus:border-signal focus:bg-surface focus:outline-none focus:ring-4 focus:ring-signal/10"
            />
          </Labeled>
        </div>
        <Labeled label={t.employerProfile.industry}>
          <Input value={industry} onChange={setIndustry} placeholder={t.employerProfile.industryPlaceholder} />
        </Labeled>
        <SelectField label={t.employerProfile.region}>
          {(id) => (
            <Select
              id={id}
              value={regionId}
              onChange={setRegionId}
              options={regionOptions}
              placeholder={t.employerProfile.regionPlaceholder}
            />
          )}
        </SelectField>
        <SelectField label={t.employerProfile.employeeCount}>
          {(id) => <Select id={id} value={employeeCount} onChange={setEmployeeCount} options={employeeOptions} placeholder="—" />}
        </SelectField>
        <Labeled label={t.employerProfile.foundedYear}>
          <Input value={foundedYear} onChange={setFoundedYear} type="number" placeholder="2020" />
        </Labeled>
        <div className="sm:col-span-2">
          <Labeled label={t.employerProfile.website}>
            <Input value={website} onChange={setWebsite} placeholder="https://example.uz" />
          </Labeled>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className="rounded-xl bg-signal px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
        >
          {saving ? t.employerProfile.saving : t.employerProfile.save}
        </button>
        {/* Natija e'lon qilinadi: muvaffaqiyat — status, xato — alert (audit R3, gap5-5) */}
        <span role="status" aria-live="polite" className="text-sm font-medium text-growth">
          {saved ? t.employerProfile.saved : ""}
        </span>
        {slug && (
          <a href={l(`/companies/${slug}`)} className="text-sm font-medium text-dusk hover:text-signal">
            {t.employerProfile.view} →
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

/** Custom `Select` — tugma, shuning uchun yorliq `htmlFor` bilan bog'lanadi (audit R3, gap5-5). */
function SelectField({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children(id)}</div>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-dusk focus:border-signal focus:bg-surface focus:outline-none focus:ring-4 focus:ring-signal/10"
    />
  );
}
