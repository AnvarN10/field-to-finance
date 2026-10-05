import { Lock } from "lucide-react";
import Link from "next/link";
import type { Role } from "../../lib/db/schema";
import { SignOutButton } from "./sign-out-button";

const PLURAL: Record<Role, string> = {
  farmer: "farmers",
  investor: "investors",
  arranger: "arrangers",
  compliance: "compliance officers",
  scas: "SCAS partners",
  elevator: "elevators and laboratories",
  lab: "elevators and laboratories",
  regulator: "regulators",
};

/** 403 state: signed in, but without the role this cabinet needs. */
export function NoAccess({ role, email, otherCabinet }: { role: Role; email: string; otherCabinet: string | null }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-6">
      <Lock aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{`This cabinet is for ${PLURAL[role]}`}</h1>
      <p className="text-muted-foreground">{`You are signed in as ${email}. Ask an arranger to grant the ${role} role to ${email}, then reload this page.`}</p>
      <div className="flex flex-wrap items-center gap-3">
        {otherCabinet ? (
          <Link href={otherCabinet} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground [@media(hover:hover)]:hover:bg-primary-hover">
            Go to your cabinet
          </Link>
        ) : null}
        <SignOutButton />
      </div>
    </div>
  );
}
