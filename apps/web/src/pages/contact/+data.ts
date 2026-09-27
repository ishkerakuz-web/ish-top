import { withServerTimeout } from "../../lib/api.js";
import { fetchSupportContacts } from "../../lib/support/api.js";
import type { SupportContactsVM } from "../../lib/support/contacts.js";

/**
 * Aloqa kanallari serverda olinadi — sahifa kontaktlar bilan birga keladi. API
 * xatosi sahifani yiqitmaydi: `contacts: null`, brauzer qayta so'raydi (forma baribir ishlaydi).
 *
 * Shuning uchun bu yerda 503 QAYTARILMAYDI (sahifaning asosiy mazmuni — forma),
 * lekin SSR so'roviga vaqt chegarasi qo'yiladi (audit R3, api-errors-2): sekin
 * API `/contact` sahifasini platforma timeout'igacha osiltirib qo'ymasin.
 */
export async function data(): Promise<{ contacts: SupportContactsVM | null }> {
  return { contacts: await fetchSupportContacts(withServerTimeout()).catch(() => null) };
}
