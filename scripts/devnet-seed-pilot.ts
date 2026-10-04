// Seeds the standing pilot pool on devnet (ADR 0014): the term sheet's numbers, open for subscription,
// with labelled sample field boundaries until the farm's export arrives. The issuer of record is a local
// stand-in keypair (~/.config/f2f/pilot-farmer.json) until the pilot farmer has a wallet.
// No pilot identifiers (BIN, cadastral numbers, farm name) are used or committed.
//
//   scripts/inf.sh pnpm exec tsx scripts/devnet-seed-pilot.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { runPilotFromEnv } from "../apps/web/src/lib/demo/pilot-flow";

function pilotFarmer(): Keypair {
  const file = path.join(os.homedir(), ".config/f2f/pilot-farmer.json");
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))));
}

runPilotFromEnv({ mode: "seed", farmer: pilotFarmer() })
  .then((r) => console.log(`\nPilot pool ${r.poolId} open; issuer of record ${r.farmer}`))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
    process.exit(1);
  });
