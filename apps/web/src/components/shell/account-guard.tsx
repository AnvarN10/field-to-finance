import { Lock } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { ReactElement } from "react";
import { homeFor } from "../../lib/auth/home";
import type { SessionUser } from "../../lib/auth/session";
import { signedInUser } from "../../lib/server/auth";
import { SignOutButton } from "../cabinet/sign-out-button";
import { ErrorState } from "../state";

const APP = {
  investor: { title: "This app is for investors", door: "/invest/signup", doorLabel: "Start investing" },
  farmer: { title: "This workspace is for farmers raising financing", door: "/apply", doorLabel: "Apply for financing" },
} as const;
const HOME_NAME: Record<string, string> = { "/console": "console", "/issuer": "issuer workspace", "/invest": "investor app" };
const primary = "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground [@media(hover:hover)]:hover:bg-primary-hover";

function NoAccount({ kind, user }: { kind: "farmer" | "investor"; user: SessionUser }) {
  const home = homeFor(user.roles);
  const a = APP[kind];
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-6">
      <Lock aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{a.title}</h1>
      <p className="text-muted-foreground">
        {home ? `You are signed in as ${user.email}, which has a ${HOME_NAME[home]}. One email holds one account kind; use another email for this one.` : `You are signed in as ${user.email}, which has no account yet.`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {home ? (
          <Link href={home} className={primary}>
            {`Go to your ${HOME_NAME[home]}`}
          </Link>
        ) : (
          <Link href={a.door} className={primary}>
            {a.doorLabel}
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

/** Page guard for the investor app (`investor`) and the issuer workspace (`farmer`). */
export async function guardAccount(kind: "farmer" | "investor", path: string): Promise<{ user: SessionUser } | { element: ReactElement }> {
  try {
    const user = await signedInUser(path);
    if (!user.roles.includes(kind)) return { element: <NoAccount kind={kind} user={user} /> };
    return { user };
  } catch (e) {
    unstable_rethrow(e);
    return { element: <ErrorState level={1} title="Your account is unavailable" body="Accounts could not be loaded. Pool pages still work; try again in a minute." retryHref={path} /> };
  }
}
