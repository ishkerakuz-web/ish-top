import type { Messages } from "../i18n/messages.js";
import type { ContactMessageInput } from "./api.js";
import { EMAIL_RE, MESSAGE_MAX, MESSAGE_MIN } from "./contacts.js";

export type ContactFieldKey = "name" | "email" | "subject" | "message";
export const CONTACT_FIELDS: readonly ContactFieldKey[] = ["name", "email", "subject", "message"];
export type ContactErrors = Partial<Record<ContactFieldKey, string>>;

/** Brauzerdagi tekshiruv — foydalanuvchiga tez javob. Server baribir o'zi qayta tekshiradi. */
export function validateContact(values: ContactMessageInput, errors: Messages["contact"]["errors"]): ContactErrors {
  const out: ContactErrors = {};
  if (!values.name.trim()) out.name = errors.nameRequired;
  const email = values.email.trim();
  if (!email) out.email = errors.emailRequired;
  else if (email.length > 254 || !EMAIL_RE.test(email)) out.email = errors.emailInvalid;
  if (!values.subject) out.subject = errors.subjectRequired;
  const message = values.message.trim();
  if (!message) out.message = errors.messageRequired;
  else if (message.length < MESSAGE_MIN) out.message = errors.messageShort(MESSAGE_MIN);
  else if (message.length > MESSAGE_MAX) out.message = errors.messageLong(MESSAGE_MAX);
  return out;
}
