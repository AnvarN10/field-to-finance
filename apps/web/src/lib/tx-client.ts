import { VersionedTransaction } from "@solana/web3.js";
import { explainChainError, extractLogs, type ExplainedError } from "./chain/explain";
import type { TxAction } from "./chain/user-tx";

export type TxPhase =
  | { phase: "idle" }
  | { phase: "building" }
  | { phase: "signing" }
  | { phase: "confirming"; signature: string }
  | { phase: "success"; signature: string; meta?: Record<string, string> }
  | { phase: "error"; error: ExplainedError; logs: string[]; signature?: string };

export interface TxSigner {
  publicKey: string;
  /** Signs only. The server adds the gas sponsor's signature and submits (ADR 0013). */
  sign(tx: VersionedTransaction): Promise<VersionedTransaction>;
}

export type PostJson = (url: string, body: unknown) => Promise<unknown>;

const NETWORK_ERROR: ExplainedError = { code: "Network", title: "Could not reach the server", detail: "Check your connection and try again.", action: "retry" };

export const postJson: PostJson = async (url, body) => {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, error: NETWORK_ERROR, logs: [] };
  }
};

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type Built = { ok: true; tx: string; blockhash: string; lastValidBlockHeight: number; meta?: Record<string, string> } | { ok: false; error: ExplainedError; logs: string[] };
type Sent = { ok: true; signature: string } | { ok: false; error: ExplainedError; logs: string[] };
type Confirmed = { ok: true } | { ok: false; error: ExplainedError; logs: string[]; signature?: string };

export async function executeTx(
  deps: { postJson: PostJson; signer: TxSigner },
  action: TxAction,
  body: Record<string, unknown>,
  onPhase: (p: TxPhase) => void,
): Promise<TxPhase> {
  onPhase({ phase: "building" });
  const built = (await deps.postJson(`/api/tx/${action}`, { ...body, signer: deps.signer.publicKey })) as Built;
  if (!built.ok) return { phase: "error", error: built.error ?? NETWORK_ERROR, logs: built.logs ?? [] };

  onPhase({ phase: "signing" });
  let signed: VersionedTransaction;
  try {
    signed = await deps.signer.sign(VersionedTransaction.deserialize(base64ToBytes(built.tx)));
  } catch (e) {
    const logs = extractLogs(e);
    return { phase: "error", error: explainChainError({ logs, error: e }), logs };
  }
  const sent = (await deps.postJson("/api/tx/send", { action, tx: bytesToBase64(signed.serialize()) })) as Sent;
  if (!sent.ok) return { phase: "error", error: sent.error ?? NETWORK_ERROR, logs: sent.logs ?? [] };
  const signature = sent.signature;

  onPhase({ phase: "confirming", signature });
  const confirmed = (await deps.postJson("/api/tx/confirm", {
    signature,
    blockhash: built.blockhash,
    lastValidBlockHeight: built.lastValidBlockHeight,
  })) as Confirmed;
  if (!confirmed.ok) return { phase: "error", error: confirmed.error, logs: confirmed.logs ?? [], signature };
  return built.meta ? { phase: "success", signature, meta: built.meta } : { phase: "success", signature };
}
