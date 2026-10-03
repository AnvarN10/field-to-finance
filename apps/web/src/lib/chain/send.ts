import { TransactionMessage, VersionedTransaction, type Connection, type Keypair, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { extractLogs, messageOf } from "./explain";

export interface UnsignedTx {
  tx: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function buildV0(
  connection: Pick<Connection, "getLatestBlockhash">,
  payer: PublicKey,
  ixs: TransactionInstruction[],
): Promise<UnsignedTx> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  return { tx: new VersionedTransaction(message), blockhash, lastValidBlockHeight };
}

export interface SimulationResult {
  err: unknown | null;
  logs: string[];
}

/** Simulates an unsigned transaction so the user sees a program rejection before their wallet opens. */
export async function simulate(connection: Pick<Connection, "simulateTransaction">, tx: VersionedTransaction): Promise<SimulationResult> {
  const r = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed" });
  return { err: r.value.err ?? null, logs: r.value.logs ?? [] };
}

export class ChainTxError extends Error {
  override name = "ChainTxError";
  constructor(
    message: string,
    readonly logs: string[],
    readonly signature: string | null,
  ) {
    super(message);
  }
}

export async function confirmOrThrow(
  connection: Pick<Connection, "confirmTransaction" | "getTransaction">,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> {
  const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) {
    const t = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    throw new ChainTxError(`transaction failed: ${JSON.stringify(res.value.err)}`, t?.meta?.logMessages ?? [], signature);
  }
}

/** Signs with server-held keys (first signer pays), sends with preflight and waits for confirmation. */
export async function sendServerTx(connection: Connection, signers: Keypair[], ixs: TransactionInstruction[]): Promise<string> {
  const payer = signers[0];
  if (!payer) throw new Error("sendServerTx needs at least one signer");
  const { tx, blockhash, lastValidBlockHeight } = await buildV0(connection, payer.publicKey, ixs);
  tx.sign(signers);
  let signature: string;
  try {
    signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
  } catch (e) {
    throw new ChainTxError(messageOf(e), extractLogs(e), null);
  }
  await confirmOrThrow(connection, signature, blockhash, lastValidBlockHeight);
  return signature;
}

/** For the demo script only: lands a failing transaction on-chain so it has an explorer link. */
export async function sendSkippingPreflight(
  connection: Connection,
  signers: Keypair[],
  ixs: TransactionInstruction[],
): Promise<{ signature: string; err: unknown | null; logs: string[] }> {
  const payer = signers[0];
  if (!payer) throw new Error("sendSkippingPreflight needs at least one signer");
  const { tx, blockhash, lastValidBlockHeight } = await buildV0(connection, payer.publicKey, ixs);
  tx.sign(signers);
  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  const t = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  return { signature, err: res.value.err, logs: t?.meta?.logMessages ?? [] };
}

export const bytesToBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
