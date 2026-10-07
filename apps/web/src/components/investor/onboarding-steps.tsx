"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { acknowledgeRiskAction, saveQuestionnaireAction, submitKycAction } from "../../app/(app)/invest/actions";
import { fieldErrors } from "../../lib/form-errors";
import { shortKey } from "../../lib/format";
import { COUNTRIES } from "../../lib/kyc";
import type { InvestorOnboarding } from "../../lib/workflow/investor";
import { KycStatusBadge } from "../cabinet/badges";
import { primaryLink } from "../cabinet/section";
import { TextField } from "../cabinet/text-field";
import { Button } from "../ui/button";
import { LinkPhantom } from "./link-phantom";

const CATEGORIES = [
  { value: "professional", label: "Professional", body: "You qualify as a Professional Client: experience and assets above the AIFC thresholds." },
  { value: "retail", label: "Retail", body: "An individual investor. Exempt-offer limits apply." },
  { value: "institutional", label: "Institutional", body: "A fund, bank or other regulated entity." },
] as const;

const select = "h-10 rounded-md border border-input bg-card px-3 text-base font-normal md:text-sm";

function Step({ n, title, done, aside, children }: { n: number; title: string; done: boolean; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`step-${n}`} className="text-base font-semibold">{`${n}. ${title}`}</h2>
        {aside ??
          (done ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" />
              Done
            </span>
          ) : null)}
      </div>
      {children}
    </section>
  );
}

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, onError?: (e: string) => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else (onError ?? setError)(r.error);
    });
  return { pending, error, setError, run };
}

const RISKS = [
  "Harvest, quality and issuer risk: holders may receive grain instead of cash if the issuer does not buy the token back.",
  "No secondary market on the platform: plan to hold to maturity.",
  "Devnet pilot: test USDC only, no real money moves.",
];

/** Investor onboarding: category, mock KYC (an arranger approves), risk acknowledgement, wallet link. */
export function OnboardingSteps({ userId, state }: { userId: string; state: InvestorOnboarding }) {
  const q = useAct();
  const kyc = useAct();
  const risk = useAct();
  const [qErrors, setQErrors] = useState<Record<string, string>>({});
  const [kErrors, setKErrors] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<string>(state.category ?? "professional");
  const locked = state.kycStatus === "approved";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {state.complete ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/12 p-4 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-success">
            <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" />
            Onboarding complete. Accept a pool's key features, then subscribe.
          </span>
          <Link href="/pools" className={primaryLink}>
            Browse open pools
          </Link>
        </div>
      ) : null}

      <Step n={1} title="Investor category" done={state.questionnaireDone}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const basis = String(f.get("basis") ?? "").trim();
            q.run(
              () => saveQuestionnaireAction({ category, netAssets: String(f.get("netAssets") ?? ""), experience: String(f.get("experience") ?? ""), ...(basis ? { basis } : {}) }),
              (err) => {
                const p = fieldErrors(err);
                setQErrors(p.fields);
                q.setError(p.rest);
              },
            );
          }}
        >
          <fieldset className="flex flex-col gap-2" disabled={locked}>
            <legend className="mb-2 text-sm font-medium">Category</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <label key={c.value} className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${category === c.value ? "border-primary bg-raised" : "border-input"}`}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} className="size-4 accent-primary" />
                    {c.label}
                  </span>
                  <span className="text-muted-foreground">{c.body}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {state.retailLimits ? <p className="rounded-md bg-muted p-3 text-sm text-foreground">{state.retailLimits}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Net assets (USD)
              <select name="netAssets" defaultValue="100k-1m" className={select} disabled={locked}>
                <option value="under-100k">Under 100,000</option>
                <option value="100k-1m">100,000 to 1 million</option>
                <option value="1m-10m">1 to 10 million</option>
                <option value="over-10m">Over 10 million</option>
              </select>
              {qErrors.netAssets ? <span className="text-xs font-normal text-destructive">{qErrors.netAssets}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Experience with bonds or structured products
              <select name="experience" defaultValue="some" className={select} disabled={locked}>
                <option value="none">None</option>
                <option value="some">Some</option>
                <option value="extensive">Extensive</option>
              </select>
            </label>
          </div>
          {category !== "retail" ? (
            <TextField label="Why you qualify" name="basis" maxLength={200} error={qErrors.basis} hint="For example: licensed fund manager, or portfolio above USD 1M" disabled={locked} />
          ) : null}
          {q.error ? (
            <p role="alert" className="text-sm text-destructive">
              {q.error}
            </p>
          ) : null}
          {locked ? (
            <p className="text-sm text-muted-foreground">Your category was approved with your KYC. Ask an arranger to change it.</p>
          ) : (
            <Button type="submit" variant={state.questionnaireDone ? "outline" : "default"} disabled={q.pending} className="self-start">
              {q.pending ? "Saving" : state.questionnaireDone ? "Update answers" : "Save answers"}
            </Button>
          )}
        </form>
      </Step>

      <Step n={2} title="Identity check" done={state.kycStatus === "approved"} aside={<KycStatusBadge status={state.kycStatus} />}>
        {!state.questionnaireDone ? (
          <p className="text-sm text-muted-foreground">Answer the questionnaire first.</p>
        ) : state.kycStatus === "approved" ? (
          <p className="text-sm text-muted-foreground">Approved. Your linked wallets carry the platform KYC record on-chain.</p>
        ) : state.kycStatus === "pending" ? (
          <p className="text-sm text-muted-foreground">Compliance is reviewing your details. This is a demo check: no documents or provider are involved.</p>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              kyc.run(
                () => {
                  const iin = String(f.get("iin") ?? "").trim();
                  return submitKycAction({ fullName: String(f.get("fullName") ?? ""), country: String(f.get("country") ?? ""), ...(iin ? { iin } : {}) });
                },
                (err) => {
                  const p = fieldErrors(err);
                  setKErrors(p.fields);
                  kyc.setError(p.rest);
                },
              );
            }}
          >
            {state.kycNote ? <p className="text-sm text-destructive">{state.kycNote}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" name="fullName" autoComplete="name" error={kErrors.fullName} />
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Country of residence
                <select name="country" defaultValue="" className={`${select} invalid:text-muted-foreground`} required>
                  <option value="" disabled>
                    Choose a country
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                {kErrors.country ? <span className="text-xs font-normal text-destructive">{kErrors.country}</span> : null}
              </label>
              <TextField label="IIN (optional)" name="iin" inputMode="numeric" maxLength={12} autoComplete="off" hint="Kazakhstan residents: 12 digits" error={kErrors.iin} />
            </div>
            <p className="text-xs text-muted-foreground">Kept in the platform's private database for compliance and the regulator. Never on-chain, never in analytics.</p>
            {kyc.error ? (
              <p role="alert" className="text-sm text-destructive">
                {kyc.error}
              </p>
            ) : null}
            <Button type="submit" disabled={kyc.pending} className="self-start">
              {kyc.pending ? "Sending" : "Send for review"}
            </Button>
          </form>
        )}
      </Step>

      <Step n={3} title="Risk acknowledgement" done={state.riskAcknowledged}>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {RISKS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {state.riskAcknowledged ? null : !state.questionnaireDone ? (
          <p className="text-sm text-muted-foreground">Answer the questionnaire first.</p>
        ) : (
          <>
            {risk.error ? (
              <p role="alert" className="text-sm text-destructive">
                {risk.error}
              </p>
            ) : null}
            <Button type="button" disabled={risk.pending} onClick={() => risk.run(acknowledgeRiskAction)} className="self-start">
              I understand these risks
            </Button>
          </>
        )}
      </Step>

      <Step n={4} title="Wallet" done={state.wallets.length > 0}>
        {state.wallets.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {state.wallets.map((w) => (
              <li key={w.address} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{shortKey(w.address)}</span>
                <span className="text-muted-foreground">{w.kind === "privy-embedded" ? "Email wallet (Privy)" : "Phantom or other wallet"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Your email wallet appears here automatically after sign-in.</p>
        )}
        <LinkPhantom userId={userId} linked={state.wallets.map((w) => w.address)} />
      </Step>
    </div>
  );
}
