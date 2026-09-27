import React, { useEffect, useRef, useState } from "react";
import { useT, useLocale } from "../../lib/i18n/index.js";
import { regionName } from "../../lib/i18n/regions.js";
import type { Profile, ProfileUpdate, Region } from "../../lib/types.js";
import { PhoneInput, isPhoneComplete } from "../PhoneInput.js";
import { Select } from "../Select.js";
import { useProfileNav } from "./ProfileNavContext.js";
import { Button, Card, Field, SaveStatus, SectionHeader, TabLink, TextInput, Toggle, focusFirstInvalid, useSaveState } from "./ui.js";
import { IconLock, IconShield, IconTelegram, IconUser } from "./icons.js";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  additionalPhone: string;
  headline: string;
  regionId: string;
  isOpenToWork: boolean;
};

function toForm(profile: Profile | null, fallback: { firstName?: string | null; lastName?: string | null }): FormState {
  return {
    firstName: profile?.firstName || fallback.firstName || "",
    lastName: profile?.lastName || fallback.lastName || "",
    phone: profile?.phone ?? "",
    additionalPhone: profile?.additionalPhone ?? "",
    headline: profile?.headline ?? "",
    regionId: profile?.regionId ?? "",
    isOpenToWork: profile?.isOpenToWork ?? true,
  };
}

const same = (a: FormState, b: FormState) => (Object.keys(a) as (keyof FormState)[]).every((k) => a[k] === b[k]);

/**
 * Shaxsiy ma'lumotlar (`PATCH /api/profile`). Saqlash mantiqi avvalgi
 * sahifadagidek: tasdiqlangan asosiy telefon qulflangan va yuborilmaydi,
 * tasdiqlanmagani to'liq (9 raqam) bo'lishi shart.
 */
export function PersonalInfo({
  profile,
  regions,
  email,
  userName,
  saveProfile,
}: {
  profile: Profile | null;
  regions: Region[];
  email: string;
  userName: { firstName?: string | null; lastName?: string | null };
  saveProfile: (update: ProfileUpdate) => Promise<Profile>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const nav = useProfileNav();
  const hub = t.profileHub;
  const initial = toForm(profile, userName);
  const [form, setForm] = useState<FormState>(initial);
  const [phoneErr, setPhoneErr] = useState(false);
  const saver = useSaveState();
  const formRef = useRef<HTMLFormElement>(null);
  const verified = profile?.isPhoneVerified ?? false;
  const dirty = !same(form, initial);

  useEffect(() => {
    if (!dirty) setForm(toForm(profile, userName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function patch(update: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...update }));
    if (saver.state === "saved" || saver.state === "error") saver.setState("idle");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!verified && !isPhoneComplete(form.phone)) {
      // Audit R3, gap5-2: xato e'lon qilinadi va fokus telefon maydoniga qaytadi
      setPhoneErr(true);
      focusFirstInvalid(formRef.current);
      return;
    }
    setPhoneErr(false);
    await saver.run(() =>
      saveProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: verified ? undefined : form.phone || null,
        additionalPhone: form.additionalPhone || null,
        headline: form.headline || null,
        regionId: form.regionId || null,
        isOpenToWork: form.isOpenToWork,
      })
    );
  }

  const regionOptions = [
    { value: "", label: t.profile.regionPlaceholder },
    ...regions.map((r) => ({ value: r.id, label: regionName(locale, r.slug, r.name) })),
  ];

  return (
    <Card as="section" className="p-5 sm:p-7">
      <SectionHeader as="h1" title={t.profile.personalSection} subtitle={hub.personal.subtitle} icon={<IconUser size={19} />} />

      <form ref={formRef} onSubmit={handleSave} noValidate className="mt-6">
        <Group title={hub.personal.basicGroup}>
          <Field label={t.profile.firstName}>
            {(p) => (
              <TextInput id={p.id} value={form.firstName} maxLength={60} autoComplete="given-name" onChange={(v) => patch({ firstName: v })} />
            )}
          </Field>
          <Field label={t.profile.lastName}>
            {(p) => (
              <TextInput id={p.id} value={form.lastName} maxLength={60} autoComplete="family-name" onChange={(v) => patch({ lastName: v })} />
            )}
          </Field>
          <Field label={t.profile.headline} className="sm:col-span-2">
            {(p) => (
              <TextInput
                id={p.id}
                value={form.headline}
                maxLength={140}
                autoComplete="organization-title"
                onChange={(v) => patch({ headline: v })}
                placeholder={t.profile.headlinePlaceholder}
              />
            )}
          </Field>
          <Field label={t.profile.region}>
            {(p) => (
              <Select
                id={p.id}
                value={form.regionId}
                onChange={(v) => patch({ regionId: v })}
                options={regionOptions}
                placeholder={t.profile.regionPlaceholder}
              />
            )}
          </Field>
        </Group>

        <Group title={hub.personal.contactGroup}>
          <Field
            label={
              <>
                {t.profile.phone}
                {verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-growth/10 px-2 py-0.5 text-[11px] font-semibold text-growth">
                    <IconShield size={11} /> {t.profile.phoneVerified}
                  </span>
                )}
              </>
            }
            required={!verified}
            error={phoneErr ? t.profile.phoneInvalid : null}
            hint={
              verified ? undefined : (
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                  <TabLink
                    href={nav.href("telegram")}
                    onNavigate={() => nav.go("telegram")}
                    className="inline-flex items-center gap-1 font-semibold text-signal hover:underline"
                  >
                    <IconTelegram size={12} /> {hub.personal.phoneVerifyLink}
                  </TabLink>
                </span>
              )
            }
          >
            {(p) =>
              verified ? (
                <div
                  id={p.id}
                  className="flex h-11 items-center justify-between rounded-xl border border-growth/30 bg-growth/5 px-3.5 text-sm font-medium text-ink"
                >
                  {profile?.phone}
                  <IconLock size={15} className="text-growth" />
                </div>
              ) : (
                <PhoneInput
                  id={p.id}
                  describedBy={p.describedBy}
                  className="h-11"
                  value={form.phone}
                  invalid={phoneErr}
                  onChange={(v) => {
                    patch({ phone: v });
                    setPhoneErr(false);
                  }}
                />
              )
            }
          </Field>
          <Field label={t.profile.additionalPhone}>
            {(p) => (
              <TextInput
                id={p.id}
                type="tel"
                inputMode="tel"
                value={form.additionalPhone}
                maxLength={30}
                onChange={(v) => patch({ additionalPhone: v })}
                placeholder={t.profile.additionalPhonePlaceholder}
              />
            )}
          </Field>
          <Field label={t.profile.email} hint={t.profile.emailHint} className="sm:col-span-2">
            {(p) => (
              <div className="relative">
                <TextInput id={p.id} describedBy={p.describedBy} value={email} onChange={() => undefined} disabled className="pr-10" />
                <IconLock size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-dusk" />
              </div>
            )}
          </Field>
        </Group>

        <Group title={hub.personal.statusGroup} last>
          <div className="sm:col-span-2">
            <Toggle
              checked={form.isOpenToWork}
              onChange={(v) => patch({ isOpenToWork: v })}
              label={t.profile.openToWork}
              hint={t.profile.openToWorkHint}
            />
          </div>
        </Group>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px]">
            {saver.state === "idle" && dirty ? (
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-gold-deep">
                <span className="h-2 w-2 rounded-full bg-gold" aria-hidden /> {hub.states.unsaved}
              </span>
            ) : (
              <SaveStatus state={saver.state} errorMessage={saver.error} />
            )}
          </div>
          <div className="flex gap-2.5">
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setForm(initial);
                  setPhoneErr(false);
                }}
                disabled={saver.state === "saving"}
              >
                {hub.states.cancel}
              </Button>
            )}
            <Button type="submit" loading={saver.state === "saving"} disabled={!dirty} className="flex-1 sm:flex-none">
              {saver.state === "saving" ? t.profile.saving : t.profile.save}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function Group({ title, children, last = false }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <fieldset className={last ? "" : "mb-7"}>
      <legend className="mb-3.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-dusk">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
