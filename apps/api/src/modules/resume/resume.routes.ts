import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../common/prisma.js";
import { requireAuth, requireRole } from "../../common/auth-guard.js";

const expSchema = z.object({
  companyName: z.string().min(1).max(120),
  position: z.string().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().max(2000).nullable().optional(),
});

const eduSchema = z.object({
  institution: z.string().min(1).max(160),
  degree: z.string().max(120).nullable().optional(),
  field: z.string().max(120).nullable().optional(),
  startYear: z.coerce.number().int().min(1950).max(2100),
  endYear: z.coerce.number().int().min(1950).max(2100).nullable().optional(),
});

const resumeSchema = z.object({
  title: z.string().min(1).max(140),
  summary: z.string().max(3000).nullable().optional(),
  desiredSalary: z.coerce.number().int().min(0).max(2_147_483_647).nullable().optional(),
  // Massivlar cheklangan (audit ISSUE-044): ilgari bitta so'rovda minglab yozuv saqlanardi
  skills: z.array(z.string().max(60)).max(50).default([]),
  experience: z.array(expSchema).max(30).default([]),
  education: z.array(eduSchema).max(20).default([]),
});

function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
}

async function loadResume(userId: string) {
  const profile = await prisma.jobSeekerProfile.findUnique({ where: { userId } });
  if (!profile) return { resume: null };
  const resume = await prisma.resume.findFirst({
    where: { jobSeekerId: profile.id },
    orderBy: { createdAt: "asc" },
    include: {
      experience: { orderBy: { startDate: "desc" } },
      education: { orderBy: { startYear: "desc" } },
      skills: true,
    },
  });
  if (!resume) return { resume: null };
  return {
    resume: {
      title: resume.title,
      summary: resume.summary,
      desiredSalary: resume.desiredSalary,
      skills: resume.skills.map((s) => s.skillName),
      experience: resume.experience.map((e) => ({
        companyName: e.companyName,
        position: e.position,
        startDate: ym(e.startDate),
        endDate: e.endDate ? ym(e.endDate) : null,
        isCurrent: e.isCurrent,
        description: e.description,
      })),
      education: resume.education.map((ed) => ({
        institution: ed.institution,
        degree: ed.degree,
        field: ed.field,
        startYear: ed.startYear,
        endYear: ed.endYear,
      })),
    },
  };
}

export async function resumeRoutes(app: FastifyInstance) {
  app.get(
    "/api/resume",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => loadResume(req.user!.sub)
  );

  app.put(
    "/api/resume",
    { preHandler: [requireAuth, requireRole("job_seeker")] },
    async (req) => {
      const body = resumeSchema.parse(req.body);
      const userId = req.user!.sub;

      let profile = await prisma.jobSeekerProfile.findUnique({ where: { userId } });
      if (!profile) {
        profile = await prisma.jobSeekerProfile.create({
          data: { userId, firstName: "", lastName: "" },
        });
      }

      let resume = await prisma.resume.findFirst({
        where: { jobSeekerId: profile.id },
        orderBy: { createdAt: "asc" },
      });
      if (!resume) {
        resume = await prisma.resume.create({
          data: { jobSeekerId: profile.id, title: body.title },
        });
      }
      const resumeId = resume.id;

      const experienceRows = body.experience.map((e) => ({
        resumeId,
        companyName: e.companyName,
        position: e.position,
        startDate: new Date(`${e.startDate}-01T00:00:00Z`),
        endDate: e.endDate ? new Date(`${e.endDate}-01T00:00:00Z`) : null,
        isCurrent: e.isCurrent ?? false,
        description: e.description ?? null,
      }));
      const educationRows = body.education.map((ed) => ({
        resumeId,
        institution: ed.institution,
        degree: ed.degree ?? null,
        field: ed.field ?? null,
        startYear: ed.startYear,
        endYear: ed.endYear ?? null,
      }));
      const skillRows = body.skills
        .map((s) => s.trim())
        .filter(Boolean)
        .map((skillName) => ({ resumeId, skillName }));

      // MongoDB bo'sh massiv bilan `createMany` ni rad etadi ("No documents
      // provided to insert_many") va butun tranzaksiya yiqiladi. Shuning uchun
      // bo'sh bo'limlar uchun yaratish so'rovi umuman qo'shilmaydi — aks holda
      // masalan ta'limi yo'q nomzod rezyumesini saqlay olmasdi.
      await prisma.$transaction([
        prisma.resume.update({
          where: { id: resumeId },
          data: {
            title: body.title,
            summary: body.summary ?? null,
            desiredSalary: body.desiredSalary ?? null,
            status: "published",
          },
        }),
        prisma.resumeExperience.deleteMany({ where: { resumeId } }),
        prisma.resumeEducation.deleteMany({ where: { resumeId } }),
        prisma.resumeSkill.deleteMany({ where: { resumeId } }),
        ...(experienceRows.length ? [prisma.resumeExperience.createMany({ data: experienceRows })] : []),
        ...(educationRows.length ? [prisma.resumeEducation.createMany({ data: educationRows })] : []),
        ...(skillRows.length ? [prisma.resumeSkill.createMany({ data: skillRows })] : []),
      ]);

      return loadResume(userId);
    }
  );
}
