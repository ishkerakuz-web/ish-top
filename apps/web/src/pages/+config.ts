import vikeReact from "vike-react/config";
import type { Config } from "vike/types";
import Layout from "../components/Layout.js";
import Head from "../components/HeadDefault.js";

export default {
  Layout,
  // Barcha sahifalar uchun umumiy <head> (theme/til init skripti, og defaultlari).
  Head,
  // Sahifaga xos <title>/meta har bir sahifaning +Head.tsx faylida (SEO).
  // Til URL prefiksidan (onBeforeRoute) aniqlanadi va clientga uzatiladi.
  passToClient: ["locale", "localePathname"],
  extends: vikeReact,
} satisfies Config;
