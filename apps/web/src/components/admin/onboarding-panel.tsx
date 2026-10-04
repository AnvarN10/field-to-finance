"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { onboardingStatusAction, uploadOnboardingDocumentAction, type OnboardingResult } from "../../app/admin/actions";
import { shortKey } from "../../lib/format";
import type { RequirementRow } from "../../lib/pilot-docs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/** Farmer onboarding checklist (ADR 0014): documents go to the bucket by hash; nothing personal goes on-chain. */
export function OnboardingPanel() {
  const [wallet, setWallet] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [rows, setRows] = useState<RequirementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const apply = (r: OnboardingResult) => {
    if (r.ok) {
      setRows(r.rows);
      setError(null);
    } else setError(r.error);
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setLoaded(wallet);
            apply(await onboardingStatusAction(wallet));
          });
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
          Farmer wallet
          <Input value={wallet} onChange={(e) => setWallet(e.target.value.trim())} spellCheck={false} autoComplete="off" className="font-mono text-base font-normal md:text-[13px]" />
        </label>
        <Button type="submit" variant="outline" disabled={wallet === "" || pending}>
          {pending && !rows ? "Loading…" : "Show checklist"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {rows && loaded ? (
        <ul aria-label="Onboarding checklist" className="flex flex-col divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
              <span className="min-w-0">{r.label}</span>
              <span className="ml-auto flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 font-medium ${r.status === "provided" ? "text-success" : "text-foreground"}`}>
                  {r.status === "provided" ? <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" /> : <CircleAlert aria-hidden strokeWidth={1.5} className="size-4" />}
                  {r.status === "provided" ? "Provided" : "Pending"}
                </span>
                {r.sha256 ? <span className="font-mono text-xs text-muted-foreground">{shortKey(r.sha256)}</span> : null}
                {r.key === "kyc" ? (
                  <span className="text-xs text-muted-foreground">{r.status === "provided" ? "Platform KYC record" : "Approve the wallet in KYC"}</span>
                ) : (
                  <label className="text-xs font-medium text-primary underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current">
                    {r.status === "provided" ? "Replace" : "Upload"}
                    <input
                      type="file"
                      aria-label={`Upload ${r.label}`}
                      className="sr-only"
                      accept="application/pdf,image/png,image/jpeg,image/webp,text/csv,application/zip,.xlsx,.docx"
                      disabled={pending}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const fd = new FormData();
                        fd.set("wallet", loaded);
                        fd.set("requirement", r.key);
                        fd.set("file", f);
                        start(async () => apply(await uploadOnboardingDocumentAction(fd)));
                      }}
                    />
                  </label>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">PDF, images, CSV, XLSX, DOCX or ZIP up to 10 MB. Files stay private to this console; the checklist stores hashes, sizes and types only.</p>
    </div>
  );
}
