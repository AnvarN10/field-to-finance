// The main flow on devnet with fresh keypairs; prints numbered scenes with explorer links.
// Also the demo-video script. Takes about 7 minutes because the pool matures 6 minutes after creation.
//
//   scripts/inf.sh pnpm demo        (or: infisical run --env=dev -- pnpm demo)
//
// PUBLIC_BASE_URL must be the deployed web app, so the evidence URIs printed on-chain resolve.
import { runFromEnv } from "../apps/web/src/lib/demo/main-flow";

runFromEnv()
  .then((r) => console.log(`\n${r.scenes} scenes, pool ${r.poolId}`))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
    process.exit(1);
  });
