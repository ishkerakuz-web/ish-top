import { prisma } from "./prisma.js";

/**
 * Ish beruvchining resurslarini aniqlash — relation filter ($lookup zanjiri) o'rniga
 * indeksli ikki bosqichli so'rov (audit ISSUE-045): owner_user_id → company_id → vacancy_id.
 *
 * "Bitta ega — bitta kompaniya" kod qoidasi (POST /api/companies 409 beradi), lekin eski
 * ma'lumotda bir nechta kompaniya bo'lishi mumkin — hammasi hisobga olinadi.
 */
export async function ownedCompanyIds(userId: string): Promise<string[]> {
  const rows = await prisma.company.findMany({ where: { ownerUserId: userId }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function ownedVacancyIds(userId: string): Promise<string[]> {
  const companyIds = await ownedCompanyIds(userId);
  if (companyIds.length === 0) return [];
  const rows = await prisma.vacancy.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
  return rows.map((row) => row.id);
}

/** Asosiy (eng birinchi yaratilgan) kompaniya — `findFirst` orderBy'siz noaniq edi. */
export function primaryCompany(userId: string) {
  return prisma.company.findFirst({ where: { ownerUserId: userId }, orderBy: { createdAt: "asc" } });
}
