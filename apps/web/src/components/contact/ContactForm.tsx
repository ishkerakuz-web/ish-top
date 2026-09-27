import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n/index.js";
import type { ContactSubjectKey } from "../../lib/i18n/types.js";
import { ApiError } from "../../lib/api.js";
import { useAuth } from "../AuthContext.js";
import { sendContactMessage, type ContactMessageInput } from "../../lib/support/api.js";
import { CONTACT_SUBJECTS, MESSAGE_MAX, NAME_MAX, type SupportContactsVM } from "../../lib/support/contacts.js";
import { CONTACT_FIELDS, validateContact, type ContactFieldKey } from "../../lib/support/validation.js";
import { ContactField, errorId, fieldClass } from "./ContactField.js";
import { ContactSubjectSelect } from "./ContactSubjectSelect.js";
import { ContactSuccess } from "./ContactSuccess.js";
import { ContactError, type ContactSendErrorKind } from "./ContactError.js";
import { IconSend, Spinner } from "../support/icons.js";

/** "Hamkorlik bo'yicha yozish" — formada mavzuni tanlab, xabar maydoniga olib boradi. */
export interface ContactPreset {
  subject: ContactSubjectKey;
  nonce: number;
}

const EMPTY: ContactMessageInput = { name: "", email: "", subject: "", message: "", website: "" };
const IDS: Record<ContactFieldKey, string> = {
  name: "contact-name",
  email: "contact-email",
  subject: "contact-subject",
  message: "contact-message",
};

/**
 * Aloqa formasi. Tekshiruv maydon ostida (maydondan chiqqanda yoki yuborishda),
 * birinchi xatoli maydonga fokus. Yuborish paytida tugma o'chiq. Xatoda matn
 * saqlanadi va "Qayta yuborish". Kirgan foydalanuvchida ism va email profildan
 * (faqat bo'sh maydonlarga, tahrirlash mumkin).
 */
export function ContactForm({ contacts, preset }: { contacts: SupportContactsVM | null; preset: ContactPreset | null }) {
  const c = useT().contact;
  const { status: authStatus, user, accessToken } = useAuth();
  const [values, setValues] = useState<ContactMessageInput>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<ContactFieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<"idle" | "sending" | "success">("idle");
  const [sendError, setSendError] = useState<ContactSendErrorKind | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const successRef = useRef<HTMLHeadingElement>(null);

  const subjects = contacts?.subjects ?? CONTACT_SUBJECTS;
  const offline = contacts !== null && !contacts.formEnabled;
  const offlineText = contacts && contacts.channels.length > 0 ? c.offlineWithChannels : c.offlineNoChannels;
  const errors = validateContact(values, c.errors);
  const visible = (field: ContactFieldKey) => ((submitted || touched[field]) && errors[field]) || null;

  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current || authStatus !== "authed" || !user) return;
    prefillDone.current = true;
    const current = valuesRef.current;
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const next = { ...current };
    if (!current.name && name) next.name = name.slice(0, NAME_MAX);
    if (!current.email && user.email) next.email = user.email;
    if (next.name !== current.name || next.email !== current.email) {
      setValues(next);
      setPrefilled(true);
    }
  }, [authStatus, user]);

  useEffect(() => {
    if (!preset) return;
    setValues((v) => ({ ...v, subject: preset.subject }));
    setPhase((p) => (p === "success" ? "idle" : p));
    const timer = window.setTimeout(() => {
      document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(IDS.message)?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [preset]);

  useEffect(() => {
    if (phase === "success") successRef.current?.focus();
  }, [phase]);

  const update = (field: keyof ContactMessageInput, value: string) => setValues((v) => ({ ...v, [field]: value }));
  const touch = (field: ContactFieldKey) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  async function send() {
    const current = valuesRef.current;
    const found = validateContact(current, c.errors);
    setSubmitted(true);
    const first = CONTACT_FIELDS.find((field) => found[field]);
    if (first) {
      document.getElementById(IDS[first])?.focus();
      return;
    }
    setPhase("sending");
    setSendError(null);
    try {
      await sendContactMessage(current, accessToken);
      setPhase("success");
    } catch (err) {
      setPhase("idle");
      const status = err instanceof ApiError ? err.status : 0;
      setSendError(status === 429 ? "rate" : status === 503 ? "offline" : "generic");
    }
  }

  const sendAnother = () => {
    setValues((v) => ({ ...v, subject: "", message: "", website: "" }));
    setTouched({});
    setSubmitted(false);
    setSendError(null);
    setPhase("idle");
    window.setTimeout(() => document.getElementById(IDS.subject)?.focus(), 30);
  };

  const sending = phase === "sending";
  const hasErrors = submitted && CONTACT_FIELDS.some((field) => errors[field]);
  const control = (field: ContactFieldKey) => ({
    id: IDS[field],
    name: field,
    onBlur: () => touch(field),
    "aria-required": true as const,
    "aria-invalid": visible(field) ? (true as const) : undefined,
    "aria-describedby": visible(field) ? errorId(IDS[field]) : undefined,
  });

  return (
    <section id="contact-form" aria-labelledby="contact-form-title" className="relative scroll-mt-24 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
      {phase === "success" ? (
        <ContactSuccess ref={successRef} onAgain={sendAnother} />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="contact-form-title" className="font-display text-xl font-bold text-ink">
              {c.formTitle}
            </h2>
            <p className="text-[12.5px] text-dusk">
              <span aria-hidden className="text-danger">
                *{" "}
              </span>
              {c.required}
            </p>
          </div>

          {offline && (
            <div role="note" data-testid="contact-offline" className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-[13.5px]">
              <p className="font-semibold text-ink">{c.offlineTitle}</p>
              <p className="mt-0.5 text-dusk">{offlineText}</p>
            </div>
          )}
          {prefilled && (
            <p className="mt-3 text-[13px] text-dusk" data-testid="contact-prefilled">
              {c.prefilled}
            </p>
          )}

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!sending && !offline) void send();
            }}
            className="mt-5 space-y-4"
          >
            {hasErrors && (
              <p role="alert" className="sr-only">
                {c.errorSummary}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <ContactField id={IDS.name} label={c.nameLabel} required error={visible("name")}>
                <input
                  {...control("name")}
                  type="text"
                  autoComplete="name"
                  maxLength={NAME_MAX}
                  value={values.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder={c.namePlaceholder}
                  className={`${fieldClass(Boolean(visible("name")))} h-12`}
                />
              </ContactField>
              <ContactField id={IDS.email} label={c.emailLabel} required error={visible("email")}>
                <input
                  {...control("email")}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={values.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder={c.emailPlaceholder}
                  className={`${fieldClass(Boolean(visible("email")))} h-12`}
                />
              </ContactField>
            </div>

            <ContactField id={IDS.subject} label={c.subjectLabel} required error={visible("subject")}>
              <ContactSubjectSelect
                id={IDS.subject}
                value={values.subject}
                subjects={subjects}
                invalid={Boolean(visible("subject"))}
                onChange={(value) => update("subject", value)}
                onBlur={() => touch("subject")}
              />
            </ContactField>

            <ContactField id={IDS.message} label={c.messageLabel} required error={visible("message")}>
              <textarea
                {...control("message")}
                rows={6}
                maxLength={MESSAGE_MAX}
                value={values.message}
                onChange={(e) => update("message", e.target.value)}
                placeholder={c.messagePlaceholder}
                className={`${fieldClass(Boolean(visible("message")))} min-h-[150px] resize-y py-3 leading-relaxed`}
              />
            </ContactField>

            {/* Honeypot: odamga ko'rinmaydi va Tab bilan ham kelinmaydi — to'ldirgan bot xabar yubora olmaydi */}
            <div aria-hidden className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => update("website", e.target.value)} />
            </div>

            {sendError && <ContactError kind={sendError} offlineText={offlineText} sending={sending} onRetry={() => void send()} />}

            <button
              type="submit"
              disabled={sending || offline}
              aria-busy={sending || undefined}
              className="glow-signal flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-signal text-[15px] font-semibold text-white transition-colors hover:bg-signal-dark disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {sending ? <Spinner size={18} /> : <IconSend size={18} />}
              {sending ? c.submitting : c.submit}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
