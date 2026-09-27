import React from "react";
import type { ConversationView } from "../../lib/messages/adapter.js";
import type { Messages } from "../../lib/i18n/messages.js";
import { CompanyLogo } from "../companies/CompanyLogo.js";

type Labels = Messages["messagesPage"];

/**
 * Suhbatdosh nomi. Kompaniyasiz admin suhbati — "ISH BOR! qo'llab-quvvatlash" (rol serverdan).
 * Nom bo'lmasa (server email bermaydi) — rol yorlig'i: "Nomzod" / "Ish beruvchi" (audit PHASE 6, V1).
 */
export function displayName(conversation: ConversationView, m: Labels): string {
  if (conversation.otherRole === "admin" && !conversation.company) return m.supportName;
  if (conversation.title) return conversation.title;
  return conversation.otherRole === "job_seeker" ? m.roles.job_seeker : m.roles.employer;
}

/** Suhbatdosh turi: "Ish beruvchi · IT", nomzodning lavozimi yoki "ISH BOR! jamoasi". */
export function participantLabel(conversation: ConversationView, m: Labels): string {
  if (conversation.otherRole === "job_seeker") return conversation.headline ?? m.roles.job_seeker;
  if (conversation.otherRole === "admin" && !conversation.company) return m.roles.admin;
  const industry = conversation.otherRole === "employer" ? conversation.company?.industry : null;
  return industry ? `${m.roles.employer} · ${industry}` : m.roles.employer;
}

/** Logo yoki avatar; rasm bo'lmasa — nomdan bosh harfli belgi (mavjud `CompanyLogo`). */
export function ParticipantAvatar({
  conversation,
  name,
  size = "sm",
}: {
  conversation: ConversationView;
  name: string;
  size?: "xs" | "sm" | "md";
}) {
  return <CompanyLogo name={name} src={conversation.avatarUrl} size={size} />;
}
