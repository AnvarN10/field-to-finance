"use client";

import { CONSOLE_ROLE_LABELS, CONSOLE_ROLES, type ConsoleRole } from "../../lib/permissions";
import { Checkbox } from "../ui/checkbox";

/** Console role checkboxes with the plain-words description of each bundle. */
export function RolePicker({ value, onChange, legend }: { value: ConsoleRole[]; onChange: (roles: ConsoleRole[]) => void; legend: string }) {
  const toggle = (r: ConsoleRole, on: boolean) => onChange(CONSOLE_ROLES.filter((x) => (x === r ? on : value.includes(x))));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {CONSOLE_ROLES.map((r) => (
        <label key={r} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 [@media(hover:hover)]:hover:bg-hover">
          <Checkbox checked={value.includes(r)} onCheckedChange={(c) => toggle(r, c === true)} className="mt-0.5" />
          <span className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">{CONSOLE_ROLE_LABELS[r].name}</span>
            <span className="text-muted-foreground">{CONSOLE_ROLE_LABELS[r].description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
