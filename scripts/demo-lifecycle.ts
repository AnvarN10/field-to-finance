// The complete platform on devnet: every service cabinet's step through the workflow code the server actions call.
// Pool A takes the buyback path (election, funding, settlement, redemption, sweep), pool B the delivery path (election,
// grain claim); the regulator exports registry, holders and events. Fake identities only. Workflow data goes to
// DEMO_DATABASE_URL (a local Postgres) or an in-process database, never to production.
//
//   DEMO_DATABASE_URL=postgres://... DEMO_EXPORT_DIR=docs/devlog/2026-10-05-regulator scripts/inf.sh pnpm exec tsx scripts/demo-lifecycle.ts
import { runLifecycleFlowFromEnv } from "../apps/web/src/lib/demo/lifecycle-flow-env";

runLifecycleFlowFromEnv()
  .then((r) => {
    console.log(`\nBuyback pool ${r.buyback.poolId}: ${r.buyback.status}. Delivery pool ${r.delivery.poolId}: ${r.delivery.status}, grain claimed.`);
    console.log(`Demo accounts: ${Object.values(r.emails).join(", ")}`);
    process.exit(0);
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
    process.exit(1);
  });
