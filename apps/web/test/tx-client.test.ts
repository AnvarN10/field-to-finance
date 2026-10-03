import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { executeTx, type TxPhase, type TxSigner } from "../src/lib/tx-client";

function unsignedTxBase64(): string {
  const payer = Keypair.generate().publicKey;
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 1 })],
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
}

const signer = (impl?: (tx: VersionedTransaction) => Promise<VersionedTransaction>): TxSigner => ({
  publicKey: Keypair.generate().publicKey.toBase58(),
  sign: vi.fn(impl ?? (async (tx: VersionedTransaction) => tx)),
});

describe("executeTx", () => {
  it("builds, signs in the wallet, hands the signed tx to the sponsor, confirms and reports each phase", async () => {
    const built = unsignedTxBase64();
    const postJson = vi.fn(async (url: string) =>
      url === "/api/tx/subscribe"
        ? { ok: true, tx: built, blockhash: "b", lastValidBlockHeight: 1, meta: { poolId: "7" } }
        : url === "/api/tx/send"
          ? { ok: true, signature: "5sig" }
          : { ok: true },
    );
    const phases: TxPhase["phase"][] = [];
    const s = signer();
    const final = await executeTx({ postJson, signer: s }, "subscribe", { poolId: "7", amount: "1" }, (p) => phases.push(p.phase));
    expect(phases).toEqual(["building", "signing", "confirming"]);
    expect(final).toEqual({ phase: "success", signature: "5sig", meta: { poolId: "7" } });
    expect(postJson).toHaveBeenCalledWith("/api/tx/subscribe", { poolId: "7", amount: "1", signer: s.publicKey });
    expect(postJson).toHaveBeenCalledWith("/api/tx/send", { action: "subscribe", tx: built });
    expect(postJson).toHaveBeenLastCalledWith("/api/tx/confirm", { signature: "5sig", blockhash: "b", lastValidBlockHeight: 1 });
  });

  it("reports a sponsor rejection without confirming", async () => {
    const error = { code: "BadRequest", title: "Transaction rejected by the gas sponsor", detail: "", action: "none" };
    const postJson = vi.fn(async (url: string) =>
      url === "/api/tx/send" ? { ok: false, error, logs: [] } : { ok: true, tx: unsignedTxBase64(), blockhash: "b", lastValidBlockHeight: 1 },
    );
    expect(await executeTx({ postJson, signer: signer() }, "subscribe", {}, () => {})).toEqual({ phase: "error", error, logs: [] });
    expect(postJson).not.toHaveBeenCalledWith("/api/tx/confirm", expect.anything());
  });

  it("stops before the wallet when simulation rejects", async () => {
    const error = { code: "KycRequired", title: "This wallet hasn't passed KYC", detail: "", action: "kyc" };
    const s = signer();
    const final = await executeTx({ postJson: async () => ({ ok: false, error, logs: ["l1"] }), signer: s }, "subscribe", {}, () => {});
    expect(final).toEqual({ phase: "error", error, logs: ["l1"] });
    expect(s.sign).not.toHaveBeenCalled();
  });

  it("explains a cancelled signature", async () => {
    const final = await executeTx(
      { postJson: async () => ({ ok: true, tx: unsignedTxBase64(), blockhash: "b", lastValidBlockHeight: 1 }), signer: signer(async () => Promise.reject(new Error("User rejected the request."))) },
      "redeem",
      {},
      () => {},
    );
    expect(final).toMatchObject({ phase: "error", error: { code: "UserRejected" } });
  });

  it("keeps the signature when the transaction fails on-chain", async () => {
    const error = { code: "PoolNotOpen", title: "x", detail: "", action: "none" };
    const postJson = vi.fn(async (url: string) =>
      url === "/api/tx/confirm"
        ? { ok: false, error, logs: ["l"], signature: "5sig" }
        : url === "/api/tx/send"
          ? { ok: true, signature: "5sig" }
          : { ok: true, tx: unsignedTxBase64(), blockhash: "b", lastValidBlockHeight: 1 },
    );
    expect(await executeTx({ postJson, signer: signer() }, "subscribe", {}, () => {})).toEqual({ phase: "error", error, logs: ["l"], signature: "5sig" });
  });
});
