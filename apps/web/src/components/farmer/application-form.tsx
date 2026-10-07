"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createApplicationAction } from "../../app/(app)/issuer/actions";
import { fieldErrors } from "../../lib/form-errors";
import { TextField } from "../cabinet/text-field";
import { Button } from "../ui/button";

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[\s,]/g, ""));
const bps = (v: FormDataEntryValue | null) => Math.round(num(v) * 100);

/** New application: the harvest being financed. Program limits (30% share, 30% coupon, 32-character names) are checked on the server. */
export function ApplicationForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const input = {
          crop: String(f.get("crop") ?? "").trim().toLowerCase(),
          grade: String(f.get("grade") ?? ""),
          volumeT: num(f.get("volumeT")),
          tokenizedShareBps: bps(f.get("sharePct")),
          requestedUsd: num(f.get("requestedUsd")),
          proposedCouponBps: bps(f.get("couponPct")),
          season: num(f.get("season")),
          elevator: String(f.get("elevator") ?? ""),
          lab: String(f.get("lab") ?? ""),
        };
        start(async () => {
          const r = await createApplicationAction(input);
          if (r.ok) return router.push(`/farmer/applications/${r.id}`);
          const p = fieldErrors(r.error);
          setErrors({ ...p.fields, sharePct: p.fields.tokenizedShareBps ?? "", couponPct: p.fields.proposedCouponBps ?? "" });
          setGeneral(p.rest);
        });
      }}
    >
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-base font-semibold">Harvest</legend>
        <TextField label="Crop" name="crop" defaultValue="wheat" error={errors.crop} />
        <TextField label="Grade" name="grade" defaultValue="3" error={errors.grade} hint="Class under the quality spec" />
        <TextField label="Season" name="season" defaultValue="2027" inputMode="numeric" error={errors.season} />
        <TextField label="Expected volume (t)" name="volumeT" defaultValue="10000" inputMode="numeric" error={errors.volumeT} />
        <TextField label="Tokenized share (%)" name="sharePct" defaultValue="30" inputMode="decimal" error={errors.sharePct || undefined} hint="Up to 30% of the volume backs the token" />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-base font-semibold">Financing</legend>
        <TextField label="Amount requested (USD)" name="requestedUsd" defaultValue="1000000" inputMode="numeric" error={errors.requestedUsd} />
        <TextField label="Proposed coupon (% a year)" name="couponPct" defaultValue="12" inputMode="decimal" error={errors.couponPct || undefined} hint="Act/360. The arranger sets the final coupon." />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold">Delivery</legend>
        <TextField label="Elevator" name="elevator" maxLength={32} error={errors.elevator} hint="Where the grain is stored and delivered" />
        <TextField label="Laboratory" name="lab" maxLength={32} error={errors.lab} hint="Accredited lab for the quality certificate" />
      </fieldset>
      {general ? (
        <p role="alert" className="text-sm text-destructive">
          {general}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Creating" : "Create application"}
      </Button>
    </form>
  );
}
