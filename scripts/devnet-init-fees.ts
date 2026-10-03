// Creates or updates the FeeConfig on devnet (ADR 0013). Admin = deployer (Config.admin).
// Treasury = F2F_TREASURY; network fee 0.50 USDC, mint fee 3 USDC, arrangement cap 1,000 bps.
//
//   scripts/inf.sh pnpm tsx scripts/devnet-init-fees.ts
import { feesPda } from "@f2f/sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { connection, explorerTx, keypairFromEnv, programAs, usdcMint } from "./lib/env";

const NETWORK_FEE = new BN(500_000);
const MINT_FEE = new BN(3_000_000);
const MAX_ARRANGEMENT_BPS = 1_000;

async function main() {
  const admin = keypairFromEnv("F2F_DEPLOYER_KEYPAIR");
  const treasuryRaw = process.env.F2F_TREASURY;
  if (!treasuryRaw) throw new Error("F2F_TREASURY is not set");
  const treasury = new PublicKey(treasuryRaw);
  const program = programAs(admin);
  const fees = feesPda(program.programId);
  const exists = (await connection.getAccountInfo(fees)) !== null;
  const accounts = { admin: admin.publicKey, treasury, usdcMint: usdcMint(), usdcTokenProgram: TOKEN_PROGRAM_ID };
  const sig = exists
    ? await program.methods.updateFeeConfig(NETWORK_FEE, MINT_FEE, MAX_ARRANGEMENT_BPS).accounts(accounts).rpc()
    : await program.methods.initFeeConfig(NETWORK_FEE, MINT_FEE, MAX_ARRANGEMENT_BPS).accounts(accounts).rpc();
  const fc = await program.account.feeConfig.fetch(fees);
  console.log(`${exists ? "update" : "init"}_fee_config: ${explorerTx(sig)}`);
  console.log(`fee_config=${fees.toBase58()} treasury=${fc.treasury.toBase58()} network_fee=${fc.networkFee} mint_fee=${fc.mintFee} max_bps=${fc.maxArrangementBps}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
