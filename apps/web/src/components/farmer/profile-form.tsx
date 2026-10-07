"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileAction } from "../../app/(app)/issuer/actions";
import { fieldErrors } from "../../lib/form-errors";
import { TextField } from "../cabinet/text-field";
import { Button } from "../ui/button";

export type ProfileValues = { legalName: string; bin: string; region: string; contact: string };

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const values = Object.fromEntries(["legalName", "bin", "region", "contact"].map((k) => [k, String(f.get(k) ?? "")]));
        start(async () => {
          setSaved(false);
          const r = await saveProfileAction(values);
          if (r.ok) {
            setErrors({});
            setGeneral(null);
            setSaved(true);
            router.refresh();
          } else {
            const p = fieldErrors(r.error);
            setErrors(p.fields);
            setGeneral(p.rest);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Legal name" name="legalName" defaultValue={initial.legalName} autoComplete="organization" error={errors.legalName} />
        <TextField label="BIN" name="bin" defaultValue={initial.bin} inputMode="numeric" maxLength={12} error={errors.bin} hint="12-digit business identification number. Kept private, never on-chain." />
        <TextField label="Region" name="region" defaultValue={initial.region} error={errors.region} />
        <TextField label="Contact person and phone" name="contact" defaultValue={initial.contact} error={errors.contact} />
      </div>
      {general ? (
        <p role="alert" className="text-sm text-destructive">
          {general}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save profile"}
        </Button>
        {saved ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
            <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
