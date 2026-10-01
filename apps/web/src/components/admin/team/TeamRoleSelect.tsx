import React from "react";
import { useT } from "../../../lib/i18n/index.js";
import { TEAM_ROLES, type TeamRole } from "../../../lib/admin/roles.js";
import { ADMIN_INPUT } from "../AdminStates.js";
import { Select } from "../../Select.js";

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
      <Select
        id={id}
        ariaLabel={label}
        value={value}
        onChange={(next) => onChange(next as TeamRole)}
        options={TEAM_ROLES.map((role) => ({ value: role, label: roles[role] }))}
        disabled={disabled}
        buttonClassName={`${ADMIN_INPUT} ${visibleLabel ? "mt-1.5" : ""} h-10 py-0`}
      />
    </div>
  );
}
