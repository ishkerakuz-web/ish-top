import type { PageContextClient } from "vike/types";
import { loadMessages } from "../lib/i18n/messages.js";

/**
 * Brauzer: hidratsiya va har bir client-side navigatsiyadan OLDIN joriy til
 * lug'atini yuklaydi. Vike bu hookni `await` qiladi — hidratsiya lug'at
 * kelgunicha kutadi, shuning uchun server HTML'i bilan farq (mismatch) bo'lmaydi.
 *
 * Til almashtirilganda ham shu yerdan o'tadi: yangi til chunk'i o'sha payt
 * yuklanadi, avvalgisi xotirada qoladi (qayta yuklanmaydi).
 */
export async function onBeforeRenderClient(pageContext: PageContextClient) {
  await loadMessages(pageContext.locale);
}
