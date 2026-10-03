import { SystemProgram, type Connection, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import type { Cooldown } from "../cooldown";
import { RequestError } from "../errors";
import { createUsdcAtaIx, mintUsdcIx, usdcAta } from "./ix";

export const SOL_MIN_LAMPORTS = 20_000_000;
export const SOL_TOPUP_LAMPORTS = 50_000_000;

export interface FaucetDeps {
  /** SOL top-up enabled (FAUCET_SOL). Off by default: the gas sponsor pays fees and rent (ADR 0013). */
  sol: boolean;
  connection: Pick<Connection, "getBalance">;
  usdcMint: PublicKey;
  /** Test-USDC mint authority; also pays the SOL top-up. */
  deployer: PublicKey;
  send(ixs: TransactionInstruction[]): Promise<string>;
  usdcAmount: bigint;
  cooldown: Cooldown;
}

export async function runFaucet(deps: FaucetDeps, wallet: PublicKey, want: { usdc: boolean }) {
  const wait = deps.cooldown.remaining(wallet.toBase58());
  if (wait > 0) throw new RequestError(`Try again in ${wait} s`, 429);
  const ixs: TransactionInstruction[] = [];
  let solLamports = 0;
  if (deps.sol && (await deps.connection.getBalance(wallet, "confirmed")) < SOL_MIN_LAMPORTS) {
    ixs.push(SystemProgram.transfer({ fromPubkey: deps.deployer, toPubkey: wallet, lamports: SOL_TOPUP_LAMPORTS }));
    solLamports = SOL_TOPUP_LAMPORTS;
  }
  if (want.usdc) {
    ixs.push(createUsdcAtaIx(deps.deployer, wallet, deps.usdcMint), mintUsdcIx(deps.usdcMint, usdcAta(deps.usdcMint, wallet), deps.deployer, deps.usdcAmount));
  }
  if (ixs.length === 0) return { signature: null, solLamports: 0, usdc: "0" };
  const signature = await deps.send(ixs);
  deps.cooldown.mark(wallet.toBase58());
  return { signature, solLamports, usdc: want.usdc ? deps.usdcAmount.toString() : "0" };
}
