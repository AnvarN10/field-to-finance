// The pilot term sheet on devnet (ADR 0014), one settlement path per run; prints numbered scenes with
// explorer links. About 8 minutes: the pool matures 7 minutes after creation.
//
//   scripts/inf.sh pnpm exec tsx scripts/demo-pilot.ts buyback
//   scripts/inf.sh pnpm exec tsx scripts/demo-pilot.ts delivery
//
// PUBLIC_BASE_URL must be the deployed web app, so evidence and spec URIs printed on-chain resolve.
import { runPilotFromEnv } from "../apps/web/src/lib/demo/pilot-flow";

const path = process.argv[2] === "delivery" ? "delivery" : "buyback";
runPilotFromEnv({ mode: "demo", path })
  .then((r) => console.log(`\n${r.scenes} scenes, pool ${r.poolId} (${path})`))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
    process.exit(1);
  });
