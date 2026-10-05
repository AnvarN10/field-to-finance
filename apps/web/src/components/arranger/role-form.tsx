"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "../../app/arranger/actions";
import { grantRoleAction } from "../../app/arranger/workflow-actions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionResultView } from "./action-result";

export function RoleForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("investor");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await grantRoleAction(email, role);
          setResult(r);
          if (r.ok) {
            setEmail("");
            router.refresh();
          }
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 basis-full flex-col gap-1.5 text-sm font-medium sm:max-w-sm sm:basis-auto">
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2.5 text-base md:text-sm">
            <option value="investor">Investor</option>
            <option value="farmer">Farmer</option>
            <option value="arranger">Arranger</option>
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Granting" : "Grant role"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The person signs in with this email through Privy; the role applies on their next page load.</p>
      {result && !result.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error.title}
        </p>
      ) : (
        <ActionResultView result={result} />
      )}
    </form>
  );
}
