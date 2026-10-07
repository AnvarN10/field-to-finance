import { Lock } from "lucide-react";
import Link from "next/link";
import { homeFor } from "../../lib/auth/home";
import type { Role } from "../../lib/db/schema";
import { PERMISSION_VERB, type Permission } from "../../lib/permissions";
import { SignOutButton } from "../cabinet/sign-out-button";

const APP_NAME: Record<string, string> = { "/invest": "investor app", "/issuer": "issuer workspace" };
const link = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground [@media(hover:hover)]:hover:bg-primary-hover";

/** Signed in without any console role: the console is invitation only. */
export function NotAMember({ email, roles }: { email: string; roles: readonly Role[] }) {
  const home = homeFor(roles);
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-6">
      <Lock aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">The console is for invited team members</h1>
      <p className="text-muted-foreground">{`You are signed in as ${email}. Console access comes with an invitation link from the F2F team; open that link while signed in with the invited email.`}</p>
      <div className="flex flex-wrap items-center gap-3">
        {home ? (
          <Link href={home} className={link}>
            {`Go to your ${APP_NAME[home] ?? "app"}`}
          </Link>
        ) : null}
        <SignOutButton />
      </div>
    </div>
  );
}

/** A console member without the permission this section needs. */
export function MissingPermission({ need }: { need: Permission[] }) {
  const verbs = need.map((p) => PERMISSION_VERB[p]).join(" or ");
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-2">
      <Lock aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">You do not have access to this section</h1>
      <p className="text-muted-foreground">{`Your console roles do not include permission to ${verbs}. A team manager can change your roles.`}</p>
      <Link href="/console" className="rounded-sm font-medium underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current">
        Back to the inbox
      </Link>
    </div>
  );
}
