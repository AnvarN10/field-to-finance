"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { inviteAction } from "../../app/console/_actions/team";
import { formatDateUtc } from "../../lib/format";
import type { ConsoleRole } from "../../lib/permissions";
import { TextField } from "../cabinet/text-field";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { RolePicker } from "./role-picker";

/**
 * Invite a member: email and roles; the link is shown once to copy (no email service in the pilot). Only the token's
 * hash is stored, so the link cannot be shown again: a lost link means a new invitation.
 */
export function InviteForm() {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<ConsoleRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; expiresAt: string; email: string } | null>(null);
  const [copied, setCopied] = useState<boolean | "failed">(false);
  const [pending, start] = useTransition();

  if (made) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{`Send this link to ${made.email}. It is shown once and works only for that email.`}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="invite-link">
            Invitation link
          </label>
          <Input id="invite-link" readOnly value={made.link} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={async () => {
              try {
                if (!navigator.clipboard) throw new Error("no clipboard");
                await navigator.clipboard.writeText(made.link);
                setCopied(true);
              } catch {
                setCopied("failed");
              }
            }}
          >
            {copied === true ? <Check aria-hidden strokeWidth={1.5} /> : <Copy aria-hidden strokeWidth={1.5} />}
            {copied === true ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {copied === true ? "Link copied." : copied === "failed" ? "Copy failed. Select the link and copy it." : ""}
        </p>
        <p className="tabular text-xs text-muted-foreground">{`Expires ${formatDateUtc(Math.floor(new Date(made.expiresAt).getTime() / 1000))}.`}</p>
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => {
            setMade(null);
            setEmail("");
            setRoles([]);
            setCopied(false);
          }}
        >
          Invite another member
        </Button>
      </div>
    );
  }

  const missing = !email.trim() && roles.length === 0 ? "Enter an email and choose at least one role." : !email.trim() ? "Enter the member's email." : roles.length === 0 ? "Choose at least one role." : null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await inviteAction(email, roles);
          if (!r.ok) return setError(r.error);
          setMade({ link: r.link, expiresAt: r.expiresAt, email: email.trim().toLowerCase() });
        });
      }}
    >
      <TextField label="Email" name="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-md" required />
      <RolePicker legend="Roles" value={roles} onChange={setRoles} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col items-start gap-2">
        <Button type="submit" disabled={pending || !email.trim() || roles.length === 0} aria-describedby={missing ? "invite-missing" : undefined}>
          {pending ? "Creating invitation" : "Create invitation"}
        </Button>
        {missing ? (
          <p id="invite-missing" className="text-sm text-muted-foreground">
            {missing}
          </p>
        ) : null}
      </div>
    </form>
  );
}
