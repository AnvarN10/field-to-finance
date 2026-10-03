"use client";

import { useState } from "react";
import { track } from "../../lib/analytics";
import { ExplorerLink } from "../explorer-link";
import { Button } from "../ui/button";

export function FaucetButton({ wallet, usdc, onDone, label }: { wallet: string; usdc: boolean; onDone?: () => void; label?: string }) {
  const [state, setState] = useState<{ busy: boolean; message: string | null; signature: string | null; failed: boolean }>({
    busy: false,
    message: null,
    signature: null,
    failed: false,
  });
  async function run() {
    setState({ busy: true, message: null, signature: null, failed: false });
    const res = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet, usdc }) })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: { title: "Could not reach the faucet" } }));
    if (res.ok) {
      track("faucet_used", { usdc });
      setState({ busy: false, message: res.signature ? "Test funds sent" : "You already have enough devnet SOL", signature: res.signature, failed: false });
      onDone?.();
    } else {
      setState({ busy: false, message: res.error?.title ?? "The faucet failed", signature: null, failed: true });
    }
  }
  return (
    <div className="flex flex-col items-start gap-1 text-sm">
      <Button type="button" variant="outline" onClick={run} disabled={state.busy}>
        {state.busy ? "Sending" : (label ?? (usdc ? "Get 1,000 test USDC" : "Get devnet SOL for fees"))}
      </Button>
      {state.message ? (
        <p className={state.failed ? "text-destructive" : "text-muted-foreground"} role="status">
          {state.message} {state.signature ? <ExplorerLink kind="tx" value={state.signature} /> : null}
        </p>
      ) : null}
    </div>
  );
}
