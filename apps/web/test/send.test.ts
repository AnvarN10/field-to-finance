import { Keypair, SystemProgram, VersionedTransaction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { ChainTxError, buildV0, bytesToBase64, sendServerTx, sendSkippingPreflight, simulate } from "../src/lib/chain/send";

const blockhash = Keypair.generate().publicKey.toBase58();
const ix = (from = Keypair.generate().publicKey) => SystemProgram.transfer({ fromPubkey: from, toPubkey: Keypair.generate().publicKey, lamports: 1 });

describe("send", () => {
  it("builds an unsigned v0 transaction paid by the payer", async () => {
    const payer = Keypair.generate().publicKey;
    const conn = { getLatestBlockhash: vi.fn(async () => ({ blockhash, lastValidBlockHeight: 99 })) };
    const u = await buildV0(conn as never, payer, [ix(payer)]);
    expect(u.lastValidBlockHeight).toBe(99);
    expect(u.tx.message.recentBlockhash).toBe(blockhash);
    expect(u.tx.message.staticAccountKeys[0]?.equals(payer)).toBe(true);
    const back = VersionedTransaction.deserialize(Buffer.from(bytesToBase64(u.tx.serialize()), "base64"));
    expect(back.message.recentBlockhash).toBe(blockhash);
  });

  it("returns simulation errors and logs", async () => {
    const conn = { simulateTransaction: vi.fn(async () => ({ value: { err: { InstructionError: [1, { Custom: 3012 }] }, logs: ["Program log: x"] } })) };
    const payer = Keypair.generate().publicKey;
    const u = await buildV0({ getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 1 }) } as never, payer, [ix(payer)]);
    const r = await simulate(conn as never, u.tx);
    expect(r.err).toEqual({ InstructionError: [1, { Custom: 3012 }] });
    expect(r.logs).toEqual(["Program log: x"]);
    expect(conn.simulateTransaction).toHaveBeenCalledWith(u.tx, expect.objectContaining({ sigVerify: false }));
  });

  it("wraps preflight failures with their logs and no signature", async () => {
    const signer = Keypair.generate();
    const conn = {
      getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 1 }),
      sendRawTransaction: vi.fn(async () => {
        throw Object.assign(new Error("Simulation failed"), { logs: ["Program log: Error Code: PoolNotOpen."] });
      }),
    };
    const err = await sendServerTx(conn as never, [signer], [ix(signer.publicKey)]).catch((e) => e);
    expect(err).toBeInstanceOf(ChainTxError);
    expect(err.logs).toEqual(["Program log: Error Code: PoolNotOpen."]);
    expect(err.signature).toBeNull();
  });

  it("reports an on-chain failure with the signature and fetched logs", async () => {
    const signer = Keypair.generate();
    const conn = {
      getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 1 }),
      sendRawTransaction: vi.fn(async () => "5sig"),
      confirmTransaction: vi.fn(async () => ({ value: { err: { InstructionError: [0, { Custom: 6007 }] } } })),
      getTransaction: vi.fn(async () => ({ meta: { logMessages: ["Program log: Error Code: PoolNotOpen."] } })),
    };
    const err = await sendServerTx(conn as never, [signer], [ix(signer.publicKey)]).catch((e) => e);
    expect(err).toBeInstanceOf(ChainTxError);
    expect(err.signature).toBe("5sig");
    expect(err.logs[0]).toContain("PoolNotOpen");
  });

  it("sendSkippingPreflight reports an on-chain failure even when confirmation throws the raw error", async () => {
    const payer = Keypair.generate();
    const err = { InstructionError: [0, { Custom: 3012 }] };
    const conn = {
      getLatestBlockhash: async () => ({ blockhash, lastValidBlockHeight: 1 }),
      sendRawTransaction: vi.fn(async () => "5sig"),
      confirmTransaction: vi.fn(async () => Promise.reject(err)),
      getTransaction: vi.fn(async () => ({ meta: { logMessages: ["Program log: AccountNotInitialized"] } })),
    };
    const r = await sendSkippingPreflight(conn as never, [payer], [ix(payer.publicKey)]);
    expect(r).toEqual({ signature: "5sig", err, logs: ["Program log: AccountNotInitialized"] });
  });
});
