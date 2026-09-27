/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // "Osmon indigo" identiteti — barcha ranglar CSS o'zgaruvchilardan
        // (global.css) keladi va light/dark'da flip bo'ladi. Havorang-oq
        // osmon foni, indigo aksentlar; logo oltini faqat "!" va yulduzlarda.
        paper: "rgb(var(--paper) / <alpha-value>)", // sahifa foni (fil suyagi / ko'mir)
        surface: "rgb(var(--surface) / <alpha-value>)", // kartochka foni
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)", // ko'tarilgan/muted fon
        ink: "rgb(var(--ink) / <alpha-value>)", // asosiy matn
        dusk: "rgb(var(--dusk) / <alpha-value>)", // so'nuq matn
        line: "rgb(var(--line) / <alpha-value>)", // chegara (border)
        // ASOSIY harakat rangi — indigo FON (tugma, chegara, halqa) + oq matn:
        // kunduzgi #4F46E5 (6.3:1), tungi #5B52EA (5.4:1).
        // DIQQAT (audit R3, D-060): `text-signal` bu tokendan EMAS,
        // `--signal-text` dan oladi (global.css oxiridagi override bloki) —
        // bitta qiymat fon va matn uchun bir vaqtda AA bera olmaydi.
        signal: {
          DEFAULT: "rgb(var(--signal) / <alpha-value>)",
          dark: "rgb(var(--signal-strong) / <alpha-value>)", // hover holati
          bright: "rgb(var(--signal) / <alpha-value>)", // eski nom — endi asosiy bilan bir xil
          soft: "rgb(var(--signal-soft) / <alpha-value>)", // yumshoq fon tint
        },
        growth: "rgb(var(--growth) / <alpha-value>)", // maosh/success — yashil
        // (tungi `bg-growth` ustida oq matn 2:1 edi — global.css quyuq matnga o'tkazadi)
        danger: "rgb(var(--danger) / <alpha-value>)", // xato holatlari
        gold: {
          DEFAULT: "rgb(var(--gold) / <alpha-value>)", // brend amberi (logo sarig'i)
          deep: "rgb(var(--gold-deep) / <alpha-value>)", // amber TEXT — AA kontrast
        },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "'Inter'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      // Soyalar minimal — identitet 1px chegaralarga tayanadi. Hover'da
      // yumshoq ko'tarilish, "pop" esa menyu/dialoglar uchun.
      boxShadow: {
        xs: "0 1px 2px rgb(28 22 10 / 0.04)",
        card: "0 1px 2px rgb(28 22 10 / 0.04)",
        "card-hover": "0 12px 32px -14px rgb(28 22 10 / 0.18), 0 2px 6px rgb(28 22 10 / 0.05)",
        pop: "0 16px 48px -16px rgb(28 22 10 / 0.28)",
      },
      // Burchaklar bir pog'ona keskinlashtirilgan (2026: sharp + 1px border).
      // Utility nomlari o'zgarmaydi — 72 ta rounded-2xl birdan yangi tilga o'tadi.
      borderRadius: {
        lg: "0.375rem", // 6px  (standart 8px)
        xl: "0.5rem", // 8px  (standart 12px)
        "2xl": "0.75rem", // 12px (standart 16px)
        "3xl": "1rem", // 16px (standart 24px)
        "4xl": "1.5rem",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(-4px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // 0.01 (0 emas!): Chrome opacity:0 dan boshlangan elementni LCP'da
        // umuman hisobga olmaydi — hero sarlavha LCP nomzodi bo'lolmay,
        // ball keskin tushadi. 0.01 ko'zga ko'rinmaydi, LCP esa to'g'ri ishlaydi.
        "fade-up": {
          "0%": { opacity: "0.01", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "card-in": {
          "0%": { opacity: "0.01", transform: "translateY(18px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Filtr paneli: telefonda pastdan, planshetda o'ngdan
        "sheet-in": {
          "0%": { transform: "translateY(24px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "drawer-in": {
          "0%": { transform: "translateX(32px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // Maosh grafiklari: ustunlar pastdan o'sadi (origin-bottom bilan)
        "bar-grow": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "bar-grow": "bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "sheet-in": "sheet-in 0.22s ease-out",
        "drawer-in": "drawer-in 0.22s ease-out",
        pop: "pop 0.16s ease-out",
        "slide-down": "slide-down 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out both",
        float: "float 5s ease-in-out infinite",
        "card-in": "card-in 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};
