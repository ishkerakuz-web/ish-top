import { adminRequest } from "./http.js";
import type { TeamRole } from "./roles.js";

export interface TeamMember {
  id: string;
  email: string;
  role: TeamRole;
  isBlocked: boolean;
  name: string | null;
  position: string | null;
  articleCount: number;
  joinedAt: string;
  isSelf: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  invitedBy?: string;
}

export interface TeamData {
  members: TeamMember[];
  invites: TeamInvite[];
}

export function fetchTeam(token: string, signal?: AbortSignal) {
  return adminRequest<TeamData>("/api/admin/team", { token, signal });
}

/** Havola javobda bir marta qaytadi (bazada faqat hash saqlanadi). */
export function createTeamInvite(token: string, input: { email: string; role: TeamRole }) {
  return adminRequest<{ invite: TeamInvite; link: string; emailSent: boolean }>("/api/admin/team/invites", {
    token,
    method: "POST",
    body: input,
  });
}

export function revokeTeamInvite(token: string, id: string) {
  return adminRequest<{ ok: true }>(`/api/admin/team/invites/${encodeURIComponent(id)}`, { token, method: "DELETE" });
}

export function updateTeamMember(
  token: string,
  id: string,
  patch: { role?: TeamRole; isBlocked?: boolean; fullName?: string; position?: string | null }
) {
  return adminRequest<TeamMember>(`/api/admin/team/${encodeURIComponent(id)}`, { token, method: "PATCH", body: patch });
}

export function fetchStaffInvite(inviteToken: string, signal?: AbortSignal) {
  return adminRequest<{ email: string; role: TeamRole; expiresAt: string }>(`/api/staff-invites/${encodeURIComponent(inviteToken)}`, {
    token: null,
    signal,
  });
}

export function acceptStaffInvite(inviteToken: string, input: { fullName: string; position?: string; password: string }) {
  return adminRequest<{ accessToken: string; role: TeamRole }>(`/api/staff-invites/${encodeURIComponent(inviteToken)}/accept`, {
    token: null,
    method: "POST",
    body: input,
  });
}
