"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { track } from "../../lib/analytics";
import { COUNTRIES } from "../../lib/kyc";
import { ExplorerLink } from "../explorer-link";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

export function KycDialog({
  open,
  onOpenChange,
  wallet,
  onApproved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  wallet: string;
  onApproved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const body = {
      wallet,
      fullName: String(form.get("fullName") ?? ""),
      country: String(form.get("country") ?? ""),
      email: String(form.get("email") ?? ""),
      eligible: form.get("eligible") === "on",
      demoConsent: form.get("demoConsent") === "on",
    };
    const res = await fetch("/api/kyc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: { title: "Could not reach the server", detail: "" } }));
    setBusy(false);
    if (res.ok) {
      track("kyc_approved");
      setSignature(res.signature);
      onApproved();
    } else {
      setError([res.error?.title, res.error?.detail].filter(Boolean).join(": "));
    }
  }

  const field = "flex flex-col gap-1.5 text-sm font-medium";
  const check = "flex items-start gap-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify your identity</DialogTitle>
          <DialogDescription>Demo KYC: the form is checked and discarded. One approval on devnet covers every pool.</DialogDescription>
        </DialogHeader>
        {signature ? (
          <div role="status" className="flex flex-col items-start gap-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-success">
              <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" />
              Verified. You can subscribe to any pool.
            </p>
            <ExplorerLink kind="tx" value={signature} />
            <Button type="button" size="lg" onClick={() => onOpenChange(false)}>
              Back to subscription
            </Button>
          </div>
        ) : (
          <form action={submit} className="flex flex-col gap-4">
            <label className={field}>
              Full name
              <Input name="fullName" required autoComplete="name" />
            </label>
            <label className={field}>
              Country of residence
              <select
                name="country"
                required
                defaultValue=""
                className="h-9 rounded-md border border-input bg-card px-3 text-sm font-normal invalid:text-muted-foreground"
              >
                <option value="" disabled>
                  Choose a country
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={field}>
              Email
              <Input name="email" type="email" required autoComplete="email" />
            </label>
            <label className={check}>
              <input name="eligible" type="checkbox" required className="mt-0.5 size-4 accent-primary" />I confirm I am an eligible investor in my
              jurisdiction.
            </label>
            <label className={check}>
              <input name="demoConsent" type="checkbox" required className="mt-0.5 size-4 accent-primary" />I understand this is a devnet demo with test
              USDC.
            </label>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Approving on devnet" : "Submit and approve"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
