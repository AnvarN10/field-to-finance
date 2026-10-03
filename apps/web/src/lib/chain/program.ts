import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { F2F_IDL, type F2f } from "@f2f/sdk";
import { Keypair, type Connection, type PublicKey } from "@solana/web3.js";

/** A throwaway signer is fine for reads and for building instructions; sends go through chain/send.ts. */
export function createProgram(connection: Connection, programId: PublicKey, signer: Keypair = Keypair.generate()) {
  const provider = new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
  return new Program<F2f>({ ...F2F_IDL, address: programId.toBase58() } as F2f, provider);
}
