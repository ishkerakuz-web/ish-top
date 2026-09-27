import type { PageContextServer } from "vike/types";
import { loadMessages } from "../lib/i18n/messages.js";

/**
 * SSR: sahifa render qilinishidan oldin joriy til lug'atini yuklaydi.
 * Vike bu hookni `await` qiladi, shuning uchun render ichida `getMessages()`
 * sinxron ishlayveradi. Til `+onBeforeRoute.ts` da URL'dan aniqlanadi.
 */
export async function onBeforeRenderHtml(pageContext: PageContextServer) {
  await loadMessages(pageContext.locale);
}
