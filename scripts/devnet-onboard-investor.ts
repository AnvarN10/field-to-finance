// Gives a wallet everything it needs to subscribe on devnet: KYC approval (thaws its
// WHEAT account), test USDC and a little SOL for fees.
//
//   scripts/inf.sh ./node_modules/.bin/tsx scripts/devnet-onboard-investor.ts <wallet> [usdc=10000]
import { F2F_PROGRAM_ID, investorPda, mintPda, poolPda } from "@f2f/sdk";
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { connection, explorerTx, keypairFromEnv, programAs, usdcMint } from "./lib/env";

const POOL_ID = Number(process.env.POOL_ID ?? 1);

export async function onboardInvestor(wallet: PublicKey, usdcAmount: number) {
  const deployer = keypairFromEnv("F2F_DEPLOYER_KEYPAIR");
  const compliance = keypairFromEnv("F2F_COMPLIANCE_KEYPAIR");
  const pool = poolPda(F2F_PROGRAM_ID, POOL_ID);
  const mint = mintPda(F2F_PROGRAM_ID, pool);
  const out: string[] = [];

  if ((await connection.getBalance(compliance.publicKey)) < 0.1 * LAMPORTS_PER_SOL) {
    await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: compliance.publicKey, lamports: 0.3 * LAMPORTS_PER_SOL })), [deployer]);
  }
  const sig = await programAs(compliance).methods
    .approveInvestor()
    .accountsPartial({ compliance: compliance.publicKey, pool, mint, investor: wallet, investorRecord: investorPda(F2F_PROGRAM_ID, wallet), tokenProgram: TOKEN_2022_PROGRAM_ID })
    .rpc();
  out.push(`approve_investor ${explorerTx(sig)}`);

  const ata = await getOrCreateAssociatedTokenAccount(connection, deployer, usdcMint(), wallet);
  const m = await mintTo(connection, deployer, usdcMint(), ata.address, deployer, BigInt(usdcAmount) * 1_000_000n);
  out.push(`mint ${usdcAmount} test USDC ${explorerTx(m)}`);

  if ((await connection.getBalance(wallet)) < 0.2 * LAMPORTS_PER_SOL) {
    const s = await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: wallet, lamports: 0.5 * LAMPORTS_PER_SOL })), [deployer]);
    out.push(`send 0.5 SOL for fees ${explorerTx(s)}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [w, amount] = process.argv.slice(2);
  if (!w) throw new Error("usage: devnet-onboard-investor.ts <wallet> [usdc]");
  onboardInvestor(new PublicKey(w), Number(amount ?? 10_000)).then((l) => console.log(l.join("\n"))).catch((e) => { console.error(e); process.exit(1); });
}
