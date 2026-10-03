// Shared helpers for devnet scripts. Secrets come from Infisical via `infisical run`.
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { F2F_IDL, type F2f } from "@f2f/sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export function keypairFromEnv(name: string): Keypair {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set; run under \`infisical run --env=dev\``);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");

export function usdcMint(): PublicKey {
  const v = process.env.USDC_MINT;
  if (!v) throw new Error("USDC_MINT is not set");
  return new PublicKey(v);
}

/** Program client whose provider wallet (fee payer) is `signer`. */
export function programAs(signer: Keypair): Program<F2f> {
  const provider = new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
  return new Program<F2f>(F2F_IDL, provider);
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: PublicKey | string) => `https://explorer.solana.com/address/${a.toString()}?cluster=devnet`;
