// Seeds devnet with one open pool so an investor can buy the Instrument from Phantom.
// Idempotent: re-running skips steps that already happened.
//
//   infisical run --env=dev -- ./node_modules/.bin/tsx scripts/devnet-seed-pool.ts
//
// SCAS is a stub here (external provider pending): every field gets a FieldVerified/Pass
// attestation whose evidence says so explicitly.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import BN from "bn.js";
import {
  attestationPda,
  canonicalJson,
  F2F_PROGRAM_ID,
  fieldPda,
  mintPda,
  polygonHash,
  poolPda,
  projectPda,
  sha256,
  toAnchorEnum,
  toHex,
} from "@f2f/sdk";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { connection, explorerAddr, explorerTx, keypairFromEnv, programAs, usdcMint } from "./lib/env";

const POOL_ID = Number(process.env.POOL_ID ?? 1);
const PROJECT_ID = 1;
const USDC = 1_000_000;

// Demo contours near Kostanay. Placeholders until the pilot farmers' real contours arrive.
const FIELDS = [
  { type: "Polygon", coordinates: [[[63.62, 53.21], [63.66, 53.21], [63.66, 53.23], [63.62, 53.23], [63.62, 53.21]]] },
  { type: "Polygon", coordinates: [[[63.68, 53.2], [63.72, 53.2], [63.72, 53.22], [63.68, 53.22], [63.68, 53.2]]] },
];

function demoProducer(): Keypair {
  const file = path.join(os.homedir(), ".config/f2f/demo-producer.json");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

async function ensureSol(payer: Keypair, to: PublicKey, min: number) {
  const bal = await connection.getBalance(to);
  if (bal >= min * LAMPORTS_PER_SOL) return;
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports: min * LAMPORTS_PER_SOL }));
  await sendAndConfirmTransaction(connection, tx, [payer]);
}

const exists = async (k: PublicKey) => (await connection.getAccountInfo(k)) !== null;

async function main() {
  const deployer = keypairFromEnv("F2F_DEPLOYER_KEYPAIR");
  const issuer = keypairFromEnv("F2F_ISSUER_KEYPAIR");
  const scas = keypairFromEnv("SCAS_SECRET_KEY");
  const producer = demoProducer();
  for (const k of [issuer, scas, producer]) await ensureSol(deployer, k.publicKey, 0.3);

  const project = projectPda(F2F_PROGRAM_ID, producer.publicKey, PROJECT_ID);
  if (!(await exists(project))) {
    const sig = await programAs(producer).methods
      .registerProject(new BN(PROJECT_ID), "wheat", 2027, new BN(4_000_000), new BN(100_000 * USDC))
      .accountsPartial({ producer: producer.publicKey, project })
      .rpc();
    console.log("register_project", explorerTx(sig));
  }

  for (let i = 0; i < FIELDS.length; i++) {
    const field = fieldPda(F2F_PROGRAM_ID, project, i);
    if (!(await exists(field))) {
      const sig = await programAs(producer).methods
        .registerField(Array.from(polygonHash(FIELDS[i])), 100_000)
        .accountsPartial({ producer: producer.publicKey, project, field })
        .rpc();
      console.log(`register_field ${i}`, explorerTx(sig));
    }
    const f = await programAs(scas).account.field.fetch(field);
    if (!f.verified) {
      const evidence = canonicalJson({
        provider: "scas-stub",
        note: "External SCAS provider integration pending",
        kind: "FieldVerified",
        verdict: "Pass",
        polygonHash: toHex(polygonHash(FIELDS[i])),
        fieldAreaHaX100: 100_000,
        recordedAt: new Date().toISOString(),
      });
      const hash = sha256(evidence);
      const sig = await programAs(scas).methods
        .recordAttestation(toAnchorEnum("FieldVerified") as never, toAnchorEnum("Pass") as never, Array.from(hash), `scas-stub:${toHex(hash)}`, 0, new BN(Math.floor(Date.now() / 1000)))
        .accountsPartial({ scas: scas.publicKey, project, field, attestation: attestationPda(F2F_PROGRAM_ID, field, f.attestationCount) })
        .rpc();
      console.log(`attest FieldVerified ${i}`, explorerTx(sig));
    }
  }

  const pool = poolPda(F2F_PROGRAM_ID, POOL_ID);
  const mint = mintPda(F2F_PROGRAM_ID, pool);
  const usdc = usdcMint();
  if (!(await exists(pool))) {
    const now = Math.floor(Date.now() / 1000);
    const sig = await programAs(issuer).methods
      .createPool(new BN(POOL_ID), {
        crop: "wheat",
        season: 2027,
        name: "Wheat 2027",
        symbol: "WHEAT-2027",
        uri: "",
        yieldBps: 1_200,
        premiumBps: 550,
        subscriptionCloseTs: new BN(now + 3 * 86_400),
        maturityTs: new BN(now + 5 * 86_400),
      })
      .accountsPartial({
        issuer: issuer.publicKey,
        pool,
        mint,
        usdcMint: usdc,
        vault: getAssociatedTokenAddressSync(usdc, pool, true, TOKEN_PROGRAM_ID),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        usdcTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("create_pool", explorerTx(sig));
  }
  let p = await programAs(issuer).account.pool.fetch(pool);
  if (p.projectCount === 0) {
    const sig = await programAs(issuer).methods.addProject().accountsPartial({ issuer: issuer.publicKey, pool, project }).rpc();
    console.log("add_project", explorerTx(sig));
  }
  p = await programAs(issuer).account.pool.fetch(pool);
  if ("draft" in p.status) {
    const sig = await programAs(issuer).methods.openPool().accountsPartial({ issuer: issuer.publicKey, pool }).rpc();
    console.log("open_pool", explorerTx(sig));
  }
  p = await programAs(issuer).account.pool.fetch(pool);
  console.log(`\nPool ${POOL_ID}: ${Object.keys(p.status)[0]}, target ${p.targetAmount.toNumber() / USDC} USDC, raised ${p.raisedAmount.toNumber() / USDC}`);
  console.log("pool", explorerAddr(pool));
  console.log("mint (WHEAT-2027)", explorerAddr(mint));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
