import type { Metadata } from "next";
import Link from "next/link";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ErrorState } from "@/components/state";
import { formatDateUtc } from "@/lib/format";
import { CONSOLE_ROLE_LABELS } from "@/lib/permissions";
import { getDb } from "@/lib/server/db";
import { inspectInvitation, type InvitationState } from "@/lib/workflow/team";
import { AcceptInvitation } from "./accept";

// The token is in the path: never send it on as a referrer, never index or cache the page.
export const metadata: Metadata = { title: "Console invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const ENDED: Record<Exclude<InvitationState, "valid">, { title: string; body: string }> = {
  invalid: { title: "This invitation link is not valid", body: "Check that you opened the whole link. If it still fails, ask the F2F team for a new invitation." },
  expired: { title: "This invitation has expired", body: "Invitations work for 7 days. Ask the F2F team for a new one." },
  revoked: { title: "This invitation was withdrawn", body: "Ask the F2F team for a new one if you still need console access." },
  used: { title: "This invitation was already used", body: "If you accepted it, sign in to open the console." },
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let view;
  try {
    view = await inspectInvitation(await getDb(), token);
  } catch {
    return <ErrorState level={1} title="Invitations are unavailable" body="Accounts could not be loaded. Try the link again in a minute." />;
  }
  if (view.state !== "valid") {
    const e = ENDED[view.state];
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 py-6">
        <h1 className="text-2xl font-semibold">{e.title}</h1>
        <p className="text-muted-foreground">{e.body}</p>
        <Link href="/sign-in" className="rounded-sm font-medium underline decoration-muted-foreground underline-offset-4">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Console invitation</p>
        <h1 className="text-2xl font-semibold">Join the Field-to-Finance console</h1>
        <p className="text-muted-foreground">{`The F2F team invited ${view.maskedEmail} with these roles:`}</p>
      </header>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {view.roles!.map((r) => (
          <li key={r} className="flex flex-col gap-0.5 p-4 text-sm">
            <span className="font-medium">{CONSOLE_ROLE_LABELS[r].name}</span>
            <span className="text-muted-foreground">{CONSOLE_ROLE_LABELS[r].description}</span>
          </li>
        ))}
      </ul>
      <p className="tabular text-sm text-muted-foreground">{`The link works once and expires ${formatDateUtc(Math.floor(view.expiresAt!.getTime() / 1000))}.`}</p>
      <AuthProvider>
        <AcceptInvitation token={token} maskedEmail={view.maskedEmail!} />
      </AuthProvider>
    </div>
  );
}
