"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMemberRolesAction } from "../../app/console/_actions/team";
import { CONSOLE_ROLE_LABELS, type ConsoleRole } from "../../lib/permissions";
import { Button } from "../ui/button";
import { RolePicker } from "./role-picker";

/** A member's console roles with an inline editor; saving an empty set removes them from the console. */
export function MemberRoles({ userId, email, roles }: { userId: string; email: string; roles: ConsoleRole[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<ConsoleRole[]>(roles);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">{roles.map((r) => CONSOLE_ROLE_LABELS[r].name).join(", ")}</span>
        <Button type="button" variant="outline" size="sm" aria-label={`Edit roles for ${email}`} onClick={() => setEditing(true)}>
          Edit roles
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <RolePicker legend={`Roles for ${email}`} value={value} onChange={setValue} />
      {value.length === 0 ? <p className="text-sm text-muted-foreground">No roles: saving removes this member from the console.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await setMemberRolesAction(userId, value);
              if (!r.ok) return setError(r.error.title);
              setEditing(false);
              router.refresh();
            })
          }
        >
          {pending ? "Saving" : "Save roles"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(roles);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
