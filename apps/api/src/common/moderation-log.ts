import type { ModerationEntity, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Moderatsiya jurnali: vakansiya, sharh, kompaniya tasdig'i va murojaatlar bo'yicha kim, qachon,
 * qanday qaror qilgani. `actorId` bo'lmasa — tizim (24 soatlik avto-tasdiq).
 *
 * Yozuv xatosi asosiy amalni to'xtatmaydi (xavfsizlik jurnali bilan bir xil yondashuv).
 */

const MAX_VALUE_LENGTH = 200;

export interface ModerationLogInput {
  entityType: ModerationEntity;
  entityId: string;
  action: string;
  actorId?: string | null;
  reason?: string | null;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

function cleanMeta(meta: ModerationLogInput["meta"]): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value.slice(0, MAX_VALUE_LENGTH) : value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function recordModeration(input: ModerationLogInput): void {
  void recordModerationMany([input]);
}

/** Ommaviy amallar uchun — bitta so'rovda. */
export async function recordModerationMany(inputs: ModerationLogInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.moderationEvent.createMany({
      data: inputs.map((input) => {
        const meta = cleanMeta(input.meta);
        return {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.reason ? { reason: input.reason.slice(0, 500) } : {}),
          ...(meta !== undefined ? { meta } : {}),
        };
      }),
    });
  } catch (err) {
    console.warn("[moderation-log] yozib bo'lmadi:", (err as Error).message);
  }
}
