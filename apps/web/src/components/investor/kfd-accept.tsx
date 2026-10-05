"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptKfdAction } from "../../app/investor/actions";
import { Button } from "../ui/button";

export function KfdAccept({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        I have read the key features and the risks, and I understand I may receive grain instead of cash.
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        size="lg"
        disabled={!checked || pending}
        className="self-start"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await acceptKfdAction(poolId);
            if (r.ok) router.push(`/pools/${poolId}#invest`);
            else setError(r.error);
          })
        }
      >
        {pending ? "Recording" : "Accept and continue to subscribe"}
      </Button>
    </div>
  );
}
