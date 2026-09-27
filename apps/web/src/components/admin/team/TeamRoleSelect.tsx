import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import { TEAM_ROLES, type TeamRole } from "../../../lib/admin/roles.js";
import { ADMIN_INPUT } from "../AdminStates.js";

/** Jamoa roli tanlovi: Super admin / Muharrir / Muallif / Moderator. */
export function TeamRoleSelect({
  id,
  label,
  value,
  onChange,
  disabled = false,
  visibleLabel = false,
  className = "",
}: {
  id: string;
  label: string;
  value: TeamRole;
  onChange: (role: TeamRole) => void;
  disabled?: boolean;
  visibleLabel?: boolean;
  className?: string;
}) {
  const roles = useT().contentAdmin.roles;
  return (
    <div className={className}>
      <label htmlFor={id} className={visibleLabel ? "block text-[13px] font-semibold text-ink" : "sr-only"}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TeamRole)}
        className={`${ADMIN_INPUT} ${visibleLabel ? "mt-1.5" : ""} h-10 py-0`}
      >
        {TEAM_ROLES.map((role) => (
          <option key={role} value={role}>
            {roles[role]}
          </option>
        ))}
      </select>
    </div>
  );
}
