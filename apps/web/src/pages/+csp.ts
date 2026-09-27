import type { Config } from "vike/types";

/**
 * audit R3, D-057 — nonce asosidagi CSP.
 *
 * Vike har SSR so'roviga tasodifiy `pageContext.cspNonce` beradi va uni o'zi
 * joylagan `<script>` teglariga qo'yadi. Siyosatning o'zi bitta joyda —
 * `+headersResponse.ts` da — quriladi.
 *
 * Dev serverda nonce OLINMAYDI: Vite HMR va React Refresh inline skriptlari
 * nonce olmaydi, CSP yoqilsa dev sahifa ishlamay qoladi. Nonce bo'lmasa Vike
 * ham, `+headersResponse` ham CSP sarlavhasini qo'ymaydi.
 */
export default {
  nonce: !import.meta.env.DEV,
} satisfies NonNullable<Config["csp"]>;
