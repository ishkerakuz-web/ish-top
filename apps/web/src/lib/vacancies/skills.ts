/**
 * Kartadagi ko'nikma teglari. Vakansiyada alohida "skills" maydoni yo'q —
 * talablar erkin matn ("React va TypeScript bo'yicha kamida 1 yillik tajriba").
 * Shuning uchun matndan faqat MA'LUM ko'nikmalar lug'at bo'yicha ajratiladi:
 * to'qima teg chiqmaydi, topilmasa ro'yxat bo'sh.
 */

const W = "[\\p{L}\\p{N}]";

/** [yorliq, qidiruv ifodasi]. Tartib — ko'rsatish ustuvorligi emas, matndagi o'rni. */
const SKILLS: [string, string][] = [
  ["React Native", "react\\s*native"],
  ["React", "react(?!\\s*native)"],
  ["Next.js", "next\\.?js"],
  ["Vue.js", "vue(?:\\.?js)?"],
  ["Angular", "angular"],
  ["TypeScript", "typescript"],
  ["JavaScript", "javascript"],
  ["Node.js", "node\\.?js"],
  ["NestJS", "nest\\.?js"],
  ["Python", "python"],
  ["Django", "django"],
  ["FastAPI", "fastapi"],
  ["Java", "java(?!script)"],
  ["Kotlin", "kotlin"],
  ["Swift", "swift"],
  ["Flutter", "flutter"],
  ["Go", "golang"],
  ["PHP", "php"],
  ["Laravel", "laravel"],
  [".NET", "\\.net"],
  ["SQL", "sql"],
  ["PostgreSQL", "postgre(?:sql|s)"],
  ["MySQL", "mysql"],
  ["MongoDB", "mongo(?:db)?"],
  ["Redis", "redis"],
  ["GraphQL", "graphql"],
  ["REST API", "rest\\s*api"],
  ["Redux", "redux(?:\\s*toolkit)?"],
  ["Zustand", "zustand"],
  ["Tailwind CSS", "tailwind(?:\\s*css)?"],
  ["Docker", "docker"],
  ["Kubernetes", "kubernetes|k8s"],
  ["Helm", "helm"],
  ["Terraform", "terraform"],
  ["Ansible", "ansible"],
  ["Prometheus", "prometheus"],
  ["Grafana", "grafana"],
  ["CI/CD", "ci\\s*/\\s*cd"],
  ["AWS", "aws"],
  ["Linux", "linux"],
  ["Git", "git"],
  ["Selenium", "selenium"],
  ["Playwright", "playwright"],
  ["Cypress", "cypress"],
  ["Jira", "jira"],
  ["Figma", "figma"],
  ["Photoshop", "photoshop"],
  ["Illustrator", "illustrator"],
  ["After Effects", "after\\s*effects"],
  ["Premiere Pro", "premiere"],
  ["Power BI", "power\\s*bi"],
  ["Tableau", "tableau"],
  ["Excel", "excel"],
  ["1C", "1\\s*[cс]"],
  ["IFRS", "ifrs|mhxs"],
  ["Amplitude", "amplitude"],
  ["Google Analytics", "google\\s*analytics"],
  ["SEO", "seo"],
  ["SMM", "smm"],
  ["UI/UX", "ui\\s*/\\s*ux|ux\\s*/\\s*ui"],
  ["Ingliz tili", "ingliz\\s*tili"],
  ["Rus tili", "rus\\s*tili"],
];

const MATCHERS = SKILLS.map(([label, pattern]) => ({
  label,
  re: new RegExp(`(?<!${W})(?:${pattern})(?!${W})`, "iu"),
}));

/** Matndan ma'lum ko'nikmalarni (takrorsiz, matndagi tartibda) ajratadi. */
export function extractSkills(text: string, limit = 8): string[] {
  if (!text) return [];
  const found: { label: string; index: number }[] = [];
  for (const { label, re } of MATCHERS) {
    const match = re.exec(text);
    if (match) found.push({ label, index: match.index });
  }
  return found
    .sort((a, b) => a.index - b.index)
    .map((f) => f.label)
    .slice(0, limit);
}
