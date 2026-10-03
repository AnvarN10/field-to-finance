// Throwaway local page for buying WHEAT-2027 from Phantom on devnet, before the real web app exists.
// The server builds the subscribe transaction; Phantom only signs it; the server sends it to devnet.
//
//   scripts/inf.sh ./node_modules/.bin/tsx scripts/buy/server.ts   → http://localhost:4400
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import BN from "bn.js";
import { F2F_PROGRAM_ID, investorPda, mintPda, poolPda } from "@f2f/sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { onboardInvestor } from "../devnet-onboard-investor";
import { connection, explorerTx, feeAccounts, keypairFromEnv, programAs, usdcMint } from "../lib/env";

const POOL_ID = Number(process.env.POOL_ID ?? 1);
const pool = poolPda(F2F_PROGRAM_ID, POOL_ID);
const mint = mintPda(F2F_PROGRAM_ID, pool);
const usdc = usdcMint();
const reader = programAs(keypairFromEnv("F2F_DEPLOYER_KEYPAIR"));
const page = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");

async function balance(owner: PublicKey, m: PublicKey, program: PublicKey): Promise<number> {
  try {
    return Number((await getAccount(connection, getAssociatedTokenAddressSync(m, owner, false, program), "confirmed", program)).amount) / 1e6;
  } catch {
    return 0;
  }
}

async function body(req: http.IncomingMessage): Promise<any> {
  let s = "";
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}

const routes: Record<string, (req: http.IncomingMessage, url: URL) => Promise<unknown>> = {
  "GET /api/pool": async () => {
    const p = await reader.account.pool.fetch(pool);
    return {
      pool: pool.toBase58(), mint: mint.toBase58(), status: Object.keys(p.status)[0], crop: p.crop, season: p.season,
      target: p.targetAmount.toNumber() / 1e6, raised: p.raisedAmount.toNumber() / 1e6, yieldBps: p.yieldBps,
      closeTs: p.subscriptionCloseTs.toNumber(), maturityTs: p.maturityTs.toNumber(),
    };
  },
  "GET /api/position": async (_req, url) => {
    const w = new PublicKey(url.searchParams.get("wallet")!);
    const rec = await connection.getAccountInfo(investorPda(F2F_PROGRAM_ID, w));
    return { usdc: await balance(w, usdc, TOKEN_PROGRAM_ID), wheat: await balance(w, mint, TOKEN_2022_PROGRAM_ID), approved: rec !== null, sol: (await connection.getBalance(w)) / 1e9 };
  },
  "POST /api/onboard": async (req) => ({ log: await onboardInvestor(new PublicKey((await body(req)).wallet), 10_000) }),
  "POST /api/subscribe-tx": async (req) => {
    const { wallet, amount } = await body(req);
    const w = new PublicKey(wallet);
    const fees = await feeAccounts(reader);
    const tx: Transaction = await reader.methods
      .subscribe(new BN(Math.round(Number(amount) * 1e6)))
      .accountsPartial({
        investor: w, payer: w, pool, investorRecord: investorPda(F2F_PROGRAM_ID, w), mint,
        investorInstrument: getAssociatedTokenAddressSync(mint, w, false, TOKEN_2022_PROGRAM_ID),
        usdcMint: usdc, investorUsdc: getAssociatedTokenAddressSync(usdc, w, false, TOKEN_PROGRAM_ID),
        vault: getAssociatedTokenAddressSync(usdc, pool, true, TOKEN_PROGRAM_ID),
        feeConfig: fees.feeConfig, treasuryUsdc: fees.treasuryUsdc,
        tokenProgram: TOKEN_2022_PROGRAM_ID, usdcTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .transaction();
    tx.feePayer = w;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return { tx: tx.serialize({ requireAllSignatures: false }).toString("base64") };
  },
  "POST /api/send": async (req) => {
    const raw = Buffer.from((await body(req)).signed, "base64");
    const sig = await connection.sendRawTransaction(raw);
    await connection.confirmTransaction(sig, "confirmed");
    return { sig, url: explorerTx(sig) };
  },
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page);
      return;
    }
    try {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(await handler(req, url)));
    } catch (e: any) {
      const logs: string[] = e?.logs ?? e?.transactionLogs ?? [];
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: e?.message ?? String(e), logs }));
    }
  })
  .listen(4400, () => console.log("http://localhost:4400"));
