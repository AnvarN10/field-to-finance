"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { track } from "../../lib/analytics";
import type { TxAction } from "../../lib/chain/user-tx";
import { executeTx, postJson, type TxPhase, type TxSigner } from "../../lib/tx-client";

export function useTransaction(
  action: TxAction,
  signer: TxSigner | null,
  opts: { onSuccess?(p: { signature: string; meta?: Record<string, string> }): void } = {},
) {
  const [state, setState] = useState<TxPhase>({ phase: "idle" });
  const router = useRouter();
  const { onSuccess } = opts;
  const lastBody = useRef<Record<string, unknown> | null>(null);

  const run = useCallback(
    async (body: Record<string, unknown>): Promise<TxPhase> => {
      lastBody.current = body;
      if (!signer) {
        const s: TxPhase = { phase: "error", error: { code: "NoWallet", title: "Connect a wallet first", detail: "", action: "none" }, logs: [] };
        setState(s);
        return s;
      }
      const final = await executeTx({ postJson, signer }, action, body, setState);
      setState(final);
      if (final.phase === "success") {
        track("tx_succeeded", { action });
        onSuccess?.({ signature: final.signature, meta: final.meta });
        router.refresh();
      } else if (final.phase === "error") {
        track("tx_failed", { action, code: final.error.code });
      }
      return final;
    },
    [action, signer, onSuccess, router],
  );

  const busy = state.phase === "building" || state.phase === "signing" || state.phase === "confirming";
  /** "Try again": re-sends the last request with a fresh blockhash. */
  const retry = useCallback(async (): Promise<TxPhase | null> => (lastBody.current ? run(lastBody.current) : null), [run]);
  return { state, busy, run, retry, reset: () => setState({ phase: "idle" }) };
}
