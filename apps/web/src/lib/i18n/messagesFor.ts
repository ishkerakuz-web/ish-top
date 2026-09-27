// +title.ts kabi React bo'lmagan joylar uchun: pageContext'dan til lug'atini oladi.
import { getMessages, type Messages } from "./messages.js";
import { pageLocale } from "./pageLocale.js";

export function messagesFor(pageContext: { locale?: unknown; urlPathname?: string; urlOriginal?: string }): Messages {
  return getMessages(pageLocale(pageContext).locale);
}
