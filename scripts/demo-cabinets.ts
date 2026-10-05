// The role cabinets end to end on devnet, through the same workflow code as the server actions: a farmer signs up
// and applies, the arranger reviews documents, approves KYC on-chain, verifies fields and structures the pool, an
// investor onboards, accepts the KFD and subscribes, the arranger disburses. Prints steps with explorer links.
// Writes demo accounts (example.com emails, fake company data) to the Railway Postgres.
//
//   scripts/inf.sh pnpm exec tsx scripts/demo-cabinets.ts
import { runCabinetFlowFromEnv } from "../apps/web/src/lib/demo/cabinet-flow-env";

runCabinetFlowFromEnv()
  .then((r) => {
    console.log(`\nApplication ${r.applicationId}, pool ${r.poolId}, status ${r.status}`);
    console.log(`Demo accounts: ${r.emails.arranger}, ${r.emails.farmer}, ${r.emails.investor}`);
    process.exit(0);
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
    process.exit(1);
  });
