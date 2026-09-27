import fs from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { AppError } from "../../common/errors.js";

/**
 * OG rasm uchun shriftlar.
 *
 * Ilgari ular `process.cwd() + "/node_modules/..."` yo'li bo'yicha, MODUL
 * YUKLANAYOTGAN paytda o'qilardi. Ikkita muammo bor edi:
 *   1) jarayon boshqa papkadan ishga tushirilsa yo'l topilmasdi;
 *   2) `readFileSync` import paytida yiqilib, butun serverni ko'tarilmay
 *      qoldirardi — vaholanki gap faqat OG rasmda.
 * Endi yo'l `require.resolve` orqali (cwd'ga bog'liq emas) topiladi va
 * shriftlar birinchi so'rovda, dangasa yuklanadi.
 */
const require = createRequire(import.meta.url);

interface LoadedFonts {
  spaceGroteskBold: Buffer;
  interRegular: Buffer;
  interMedium: Buffer;
  /**
   * Kirill harflari (audit R3, seo-7). Space Grotesk'da kirill subset umuman yo'q, Inter'ning
   * `latin` fayllarida ham yo'q — ruscha sarlavhali e'lonning ulashish rasmi bo'sh chiqardi.
   * Satori bir oila ichida emas, FAQAT boshqa nomdagi shriftlar orasidan yetishmagan belgini
   * qidiradi, shuning uchun bu fayllar alohida "Inter Cyrillic" oilasi sifatida ro'yxatdan
   * o'tkaziladi.
   */
  interCyrillicRegular: Buffer;
  interCyrillicMedium: Buffer;
  interCyrillicBold: Buffer;
}

let fonts: LoadedFonts | null = null;

function loadFonts(): LoadedFonts {
  if (fonts) return fonts;
  const read = (specifier: string) => fs.readFileSync(require.resolve(specifier));
  try {
    fonts = {
      spaceGroteskBold: read("@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff"),
      interRegular: read("@fontsource/inter/files/inter-latin-400-normal.woff"),
      interMedium: read("@fontsource/inter/files/inter-latin-600-normal.woff"),
      interCyrillicRegular: read("@fontsource/inter/files/inter-cyrillic-400-normal.woff"),
      interCyrillicMedium: read("@fontsource/inter/files/inter-cyrillic-600-normal.woff"),
      interCyrillicBold: read("@fontsource/inter/files/inter-cyrillic-700-normal.woff"),
    };
    return fonts;
  } catch (e) {
    throw new AppError(
      503,
      "OG_FONTS_MISSING",
      `OG rasm shriftlarini yuklab bo'lmadi: ${(e as Error).message}`
    );
  }
}

export interface OgVacancyInput {
  title: string;
  companyName: string;
  regionName: string;
  salaryLabel: string;
}

export async function renderVacancyOgImage(input: OgVacancyInput): Promise<Buffer> {
  const { spaceGroteskBold, interRegular, interMedium, interCyrillicRegular, interCyrillicMedium, interCyrillicBold } =
    loadFonts();

  const markup = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px",
        backgroundColor: "#0F1B2D",
        backgroundImage:
          "radial-gradient(circle at 18% 14%, rgba(30,136,229,0.35) 0%, rgba(30,136,229,0) 42%), radial-gradient(circle at 88% 82%, rgba(255,193,7,0.25) 0%, rgba(255,193,7,0) 45%)",
        // Kirill belgilari uchun zaxira oila (audit R3, seo-7)
        fontFamily: "Inter, Inter Cyrillic",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: "10px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "14px",
                    height: "14px",
                    borderRadius: "999px",
                    backgroundColor: "#FFC107",
                    border: "3px solid #1E88E5",
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: "Space Grotesk, Inter Cyrillic",
                    fontSize: "30px",
                    fontWeight: 700,
                    color: "#F6F5FB",
                  },
                  children: "ISH BOR!",
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "22px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    // Sarlavha kirill bo'lsa harflar "Inter Cyrillic" dan olinadi (audit R3, seo-7)
                    fontFamily: "Space Grotesk, Inter Cyrillic",
                    fontSize: "58px",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    lineHeight: 1.15,
                    maxWidth: "1000px",
                  },
                  children: input.title,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "30px",
                    color: "rgba(246,245,251,0.65)",
                    fontWeight: 500,
                  },
                  children: `${input.companyName} · ${input.regionName}`,
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "18px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "38px",
                    fontWeight: 600,
                    color: "#16A488",
                  },
                  children: input.salaryLabel,
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(markup as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Space Grotesk", data: spaceGroteskBold, weight: 700, style: "normal" },
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interMedium, weight: 600, style: "normal" },
      { name: "Inter Cyrillic", data: interCyrillicRegular, weight: 400, style: "normal" },
      { name: "Inter Cyrillic", data: interCyrillicMedium, weight: 600, style: "normal" },
      { name: "Inter Cyrillic", data: interCyrillicBold, weight: 700, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}
