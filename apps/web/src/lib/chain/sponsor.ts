import type { Program } from "@anchor-lang/core";
import { configPda, feesPda, fieldPda, investorPda, projectPda, type F2f } from "@f2f/sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram, VersionedTransaction, type Connection, type Keypair } from "@solana/web3.js";
import { RequestError } from "../errors";
import { instrumentAta, usdcAta } from "./ix";
import type { TxAction } from "./user-tx";

/**
 * ADR 0013: the server co-signs user transactions as fee payer only after this check passes.
 * The sponsor's signature authorises every instruction in the message, so the message may hold
 * nothing but the f2f instructions /api/tx builds for the action (plus a bounded compute budget),
 * with the sponsor in exactly two places: the fee payer and the program's `payer` (rent) account.
 */
export interface SponsorPolicy {
  program: Program<F2f>;
  sponsor: PublicKey;
  usdcMint: PublicKey;
  /** FeeConfig.treasury, or null while fees are not configured. */
  treasury: PublicKey | null;
}

/** Priority fee cap: 50,000 micro-lamports per CU is 0.01 SOL at the 200k CU default limit. */
export const MAX_CU_PRICE_MICROLAMPORTS = 50_000n;
export const MAX_CU_LIMIT = 1_400_000;
const MAX_FIELDS_PER_TX = 4;

export class SponsorRejected extends RequestError {
  override name = "SponsorRejected";
  constructor(message: string) {
    super(`Transaction rejected by the gas sponsor: ${message}`, 400);
  }
}

const norm = (s: string) => s.replace(/_/g, "").toLowerCase();

const ACTION_IXS: Record<TxAction, { first: string; rest?: string }> = {
  "register-project": { first: "registerproject", rest: "registerfield" },
  subscribe: { first: "subscribe" },
  refund: { first: "refund" },
  redeem: { first: "redeem" },
};

interface DecodedIx {
  name: string;
  data: Record<string, unknown>;
  accounts: Map<string, PublicKey>;
  keys: PublicKey[];
}

function checkComputeBudget(data: Uint8Array, seen: Set<number>): void {
  const tag = data[0];
  if (tag === undefined || seen.has(tag)) throw new SponsorRejected("duplicate or empty compute budget instruction");
  seen.add(tag);
  const view = Buffer.from(data);
  if (tag === 2 && data.length === 5) {
    if (view.readUInt32LE(1) > MAX_CU_LIMIT) throw new SponsorRejected("compute unit limit is too high");
    return;
  }
  if (tag === 3 && data.length === 9) {
    if (view.readBigUInt64LE(1) > MAX_CU_PRICE_MICROLAMPORTS) throw new SponsorRejected("compute unit price is above the sponsor's cap");
    return;
  }
  throw new SponsorRejected("only compute unit limit and price instructions are allowed");
}

function checkUsdcAtaCreate(keys: PublicKey[], data: Uint8Array, p: SponsorPolicy, signer: PublicKey): void {
  const [payer, ata, owner, mint, system, tokenProgram] = keys;
  const ok =
    keys.length === 6 &&
    data.length === 1 &&
    data[0] === 1 && // CreateIdempotent
    payer?.equals(p.sponsor) &&
    owner?.equals(signer) &&
    mint?.equals(p.usdcMint) &&
    ata?.equals(usdcAta(p.usdcMint, signer)) &&
    system?.equals(SystemProgram.programId) &&
    tokenProgram?.equals(TOKEN_PROGRAM_ID);
  if (!ok) throw new SponsorRejected("unexpected associated token account instruction");
}

function decodeF2f(p: SponsorPolicy, data: Uint8Array, keys: PublicKey[]): DecodedIx {
  const coder = p.program.coder.instruction as unknown as { decode(data: Buffer): { name: string; data: unknown } | null };
  const d = coder.decode(Buffer.from(data));
  if (!d) throw new SponsorRejected("undecodable f2f instruction");
  const name = norm(d.name);
  const idlIx = (p.program.idl.instructions as { name: string; accounts: { name: string }[] }[]).find((i) => norm(i.name) === name);
  if (!idlIx || idlIx.accounts.length !== keys.length) throw new SponsorRejected(`${d.name} has an unexpected account list`);
  const accounts = new Map(idlIx.accounts.map((a, i) => [norm(a.name), keys[i] as PublicKey]));
  return { name, data: d.data as Record<string, unknown>, accounts, keys };
}

function expectAccount(ix: DecodedIx, name: string, want: PublicKey): void {
  const got = ix.accounts.get(norm(name));
  if (!got?.equals(want)) throw new SponsorRejected(`${ix.name}: account ${name} is not the expected ${want.toBase58()}`);
}

/** Anchor encodes an absent optional account as the program id. */
function expectOptional(ix: DecodedIx, p: SponsorPolicy, name: string, want: PublicKey | null): void {
  expectAccount(ix, name, want ?? p.program.programId);
}

function checkSponsorSlots(ix: DecodedIx, p: SponsorPolicy): void {
  const payer = ix.accounts.get("payer");
  if (payer && !payer.equals(p.sponsor)) throw new SponsorRejected(`${ix.name}: rent payer must be the gas sponsor`);
  for (const [name, key] of ix.accounts) {
    if (name !== "payer" && key.equals(p.sponsor)) throw new SponsorRejected(`${ix.name}: the sponsor may only pay rent, not act as ${name}`);
  }
}

function checkHolder(ix: DecodedIx, p: SponsorPolicy, signer: PublicKey): void {
  const mint = ix.accounts.get("mint");
  if (!mint) throw new SponsorRejected(`${ix.name}: missing mint`);
  expectAccount(ix, "investor", signer);
  expectAccount(ix, "investorInstrument", instrumentAta(mint, signer));
  expectAccount(ix, "usdcMint", p.usdcMint);
  expectAccount(ix, "investorUsdc", usdcAta(p.usdcMint, signer));
  expectAccount(ix, "tokenProgram", TOKEN_2022_PROGRAM_ID);
  expectAccount(ix, "usdcTokenProgram", TOKEN_PROGRAM_ID);
}

function checkSubscribe(ix: DecodedIx, p: SponsorPolicy, signer: PublicKey): void {
  checkHolder(ix, p, signer);
  const pid = p.program.programId;
  expectAccount(ix, "investorRecord", investorPda(pid, signer));
  expectAccount(ix, "feeConfig", feesPda(pid));
  if (p.treasury) {
    const want = usdcAta(p.usdcMint, p.treasury);
    if (!ix.accounts.get("treasuryusdc")?.equals(want)) throw new SponsorRejected("subscribe: treasury account is not the fee treasury's USDC account");
  } else expectOptional(ix, p, "treasuryUsdc", null);
  expectAccount(ix, "associatedTokenProgram", ASSOCIATED_TOKEN_PROGRAM_ID);
  expectAccount(ix, "systemProgram", SystemProgram.programId);
}

function checkRegisterProject(ix: DecodedIx, p: SponsorPolicy, signer: PublicKey): PublicKey {
  const pid = p.program.programId;
  const raw = ix.data.projectId ?? ix.data.project_id;
  if (raw === undefined) throw new SponsorRejected("register_project: missing project id");
  const project = projectPda(pid, signer, BigInt(String(raw)));
  expectAccount(ix, "producer", signer);
  expectAccount(ix, "config", configPda(pid));
  expectAccount(ix, "project", project);
  expectAccount(ix, "feeConfig", feesPda(pid));
  if (p.treasury) {
    expectOptional(ix, p, "usdcMint", p.usdcMint);
    expectOptional(ix, p, "producerUsdc", usdcAta(p.usdcMint, signer));
    if (!ix.accounts.get("treasuryusdc")?.equals(usdcAta(p.usdcMint, p.treasury))) {
      throw new SponsorRejected("register_project: treasury account is not the fee treasury's USDC account");
    }
    expectOptional(ix, p, "usdcTokenProgram", TOKEN_PROGRAM_ID);
  } else {
    for (const name of ["usdcMint", "producerUsdc", "treasuryUsdc", "usdcTokenProgram"]) expectOptional(ix, p, name, null);
  }
  expectAccount(ix, "systemProgram", SystemProgram.programId);
  return project;
}

function checkRegisterField(ix: DecodedIx, p: SponsorPolicy, signer: PublicKey, project: PublicKey, index: number): void {
  expectAccount(ix, "producer", signer);
  expectAccount(ix, "project", project);
  expectAccount(ix, "field", fieldPda(p.program.programId, project, index));
  expectAccount(ix, "systemProgram", SystemProgram.programId);
}

/** Throws SponsorRejected unless `tx` is exactly a sponsored `action` transaction. Returns the user signer. */
export function validateSponsoredTx(p: SponsorPolicy, action: TxAction, tx: VersionedTransaction): { signer: PublicKey } {
  const msg = tx.message;
  if ("addressTableLookups" in msg && msg.addressTableLookups.length > 0) throw new SponsorRejected("address lookup tables are not allowed");
  const keys = msg.staticAccountKeys;
  if (!keys[0]?.equals(p.sponsor)) throw new SponsorRejected("fee payer must be the gas sponsor");
  if (msg.header.numRequiredSignatures !== 2) throw new SponsorRejected("exactly the sponsor and one wallet must sign");
  const signer = keys[1] as PublicKey;
  if (signer.equals(p.sponsor)) throw new SponsorRejected("the sponsor cannot sign as the user");

  const budgetSeen = new Set<number>();
  let ataCreates = 0;
  const f2f: DecodedIx[] = [];
  for (const ci of msg.compiledInstructions) {
    const programId = keys[ci.programIdIndex];
    const ixKeys = ci.accountKeyIndexes.map((i) => {
      const k = keys[i];
      if (!k) throw new SponsorRejected("account index out of range");
      return k;
    });
    if (!programId) throw new SponsorRejected("program index out of range");
    if (programId.equals(ComputeBudgetProgram.programId)) {
      if (ixKeys.length !== 0) throw new SponsorRejected("compute budget instructions take no accounts");
      checkComputeBudget(ci.data, budgetSeen);
    } else if (programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) && (action === "refund" || action === "redeem") && f2f.length === 0 && ataCreates === 0) {
      checkUsdcAtaCreate(ixKeys, ci.data, p, signer);
      ataCreates++;
    } else if (programId.equals(p.program.programId)) {
      f2f.push(decodeF2f(p, ci.data, ixKeys));
    } else {
      throw new SponsorRejected(`program ${programId.toBase58()} is not allowed`);
    }
  }

  const want = ACTION_IXS[action];
  const [first, ...rest] = f2f;
  if (!first) throw new SponsorRejected(`no ${want.first} instruction`);
  for (const ix of f2f) {
    if (ix.name !== want.first && ix.name !== want.rest) throw new SponsorRejected(`${ix.name} is not allowed in a ${action} transaction`);
  }
  if (first.name !== want.first) throw new SponsorRejected(`a ${action} transaction must start with ${want.first}`);
  if (rest.length > (want.rest ? MAX_FIELDS_PER_TX : 0) || rest.some((ix) => ix.name !== want.rest)) {
    throw new SponsorRejected(`unexpected instructions after ${want.first}`);
  }
  for (const ix of f2f) checkSponsorSlots(ix, p);

  if (action === "subscribe") checkSubscribe(first, p, signer);
  else if (action === "refund" || action === "redeem") checkHolder(first, p, signer);
  else {
    if (rest.length === 0) throw new SponsorRejected("register_project needs at least one field");
    const project = checkRegisterProject(first, p, signer);
    rest.forEach((ix, i) => checkRegisterField(ix, p, signer, project, i));
  }
  return { signer };
}

export interface CosignDeps {
  policy: SponsorPolicy;
  sponsorKey: Keypair;
  connection: Pick<Connection, "sendRawTransaction">;
}

/**
 * Validates a wallet-signed transaction, adds the sponsor's fee-payer signature and submits it with
 * preflight (a transaction that would fail is never landed, so it costs the sponsor nothing).
 */
export async function cosignAndSend(deps: CosignDeps, action: TxAction, txBase64: string): Promise<string> {
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
  } catch {
    throw new SponsorRejected("not a serialized transaction");
  }
  if (!deps.sponsorKey.publicKey.equals(deps.policy.sponsor)) throw new Error("sponsor key does not match the policy");
  validateSponsoredTx(deps.policy, action, tx);
  const userSig = tx.signatures[1];
  if (!userSig || userSig.every((b) => b === 0)) throw new SponsorRejected("the wallet signature is missing");
  tx.sign([deps.sponsorKey]);
  return deps.connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 });
}
