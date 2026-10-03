// Initializes a freshly deployed f2f program on devnet: creates a test USDC mint
// (unless USDC_MINT is set) and calls init_config. Run immediately after deploy,
// because init_config accepts the first caller (see docs/systems/program.md).
//
//   infisical run --env=dev -- pnpm tsx scripts/devnet-bootstrap.ts
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { createMint } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../anchor/target/idl/f2f.json" with { type: "json" };
import type { F2f } from "../anchor/target/types/f2f";

function keypair(name: string): Keypair {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function main() {
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const admin = keypair("F2F_DEPLOYER_KEYPAIR");
  const issuer = keypair("F2F_ISSUER_KEYPAIR").publicKey;
  const scas = keypair("SCAS_SECRET_KEY").publicKey;
  const compliance = keypair("F2F_COMPLIANCE_KEYPAIR").publicKey;
  const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
  const program = new Program<F2f>(idl as F2f, provider);

  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  if (await connection.getAccountInfo(config)) {
    const c = await program.account.config.fetch(config);
    console.log(`config already initialized; admin=${c.admin.toBase58()} usdc=${c.usdcMint.toBase58()}`);
    return;
  }

  const usdcMint = process.env.USDC_MINT
    ? new PublicKey(process.env.USDC_MINT)
    : await createMint(connection, admin, admin.publicKey, null, 6);
  console.log(`USDC_MINT=${usdcMint.toBase58()}`);

  const sig = await program.methods
    .initConfig(issuer, scas, compliance)
    .accounts({ admin: admin.publicKey, usdcMint })
    .rpc();
  console.log(`init_config: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
