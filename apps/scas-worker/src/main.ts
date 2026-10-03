import { normalizePolygon } from "@f2f/sdk";
import { serve } from "@hono/node-server";
import { runAttestation, type AttestDeps, type AttestRequest } from "./attest";
import { createChain } from "./chain";
import { buildCli } from "./cli";
import { loadCdseConfig, loadConfig, type Config } from "./config";
import { createApp } from "./http";
import { uploadPolygon } from "./polygons";
import { SentinelClient } from "./sentinel/client";
import { buildStatsRequest, windowEndingAt } from "./sentinel/request";
import { flushSentry, initSentry, reportError } from "./sentry";
import { S3Store } from "./store";

const VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

function buildRuntime(config: Config) {
  const store = new S3Store({
    bucket: config.bucket.name,
    endpoint: config.bucket.endpoint,
    region: config.bucket.region,
    accessKeyId: config.bucket.accessKeyId,
    secretAccessKey: config.bucket.secretAccessKey,
    forcePathStyle: config.bucket.forcePathStyle,
  });
  const chain = createChain({ rpcUrl: config.solana.rpcUrl, programId: config.solana.programId, scas: config.scas });
  const sentinel = new SentinelClient(config.cdse);
  const deps: AttestDeps = {
    chain,
    sentinel,
    store,
    evidenceBaseUrl: config.evidenceBaseUrl,
    programId: config.solana.programId,
    cluster: config.solana.cluster,
  };

  // Check the SCAS key against Config once, lazily, so /health works before the program is on devnet.
  let authority: Promise<void> | undefined;
  const ensureAuthority = () =>
    (authority ??= chain.assertScasAuthority().catch((err: unknown) => {
      authority = undefined;
      throw err;
    }));

  return {
    config,
    store,
    chain,
    attest: async (req: AttestRequest) => {
      if (!req.dryRun) await ensureAuthority();
      return runAttestation(deps, req);
    },
    putPolygon: (geojson: unknown) => uploadPolygon(store, geojson),
  };
}

async function main(): Promise<void> {
  initSentry({ dsn: process.env.SENTRY_DSN || undefined, environment: process.env.SENTRY_ENVIRONMENT ?? "development" });
  let runtime: ReturnType<typeof buildRuntime> | undefined;
  const rt = () => (runtime ??= buildRuntime(loadConfig()));

  const cli = buildCli({
    attest: (req) => rt().attest(req),
    putPolygon: (geojson) => rt().putPolygon(geojson),
    stats: (polygon, asOf, days) =>
      new SentinelClient(loadCdseConfig()).fetchStats(buildStatsRequest(normalizePolygon(polygon), windowEndingAt(asOf, days))),
    print: (text) => process.stdout.write(text.endsWith("\n") ? text : `${text}\n`),
    printError: (text) => process.stderr.write(text),
    serve: async () => {
      const r = rt();
      const app = createApp({
        attest: r.attest,
        putPolygon: r.putPolygon,
        store: r.store,
        apiToken: r.config.apiToken,
        scas: r.chain.scas,
        version: VERSION,
        reportError,
      });
      serve({ fetch: app.fetch, port: r.config.port, hostname: "0.0.0.0" }, (info) => {
        console.log(`scas-worker ${VERSION} listening on :${info.port} as ${r.chain.scas.toBase58()}`);
      });
      await new Promise<never>(() => {});
    },
  });
  await cli.parseAsync(process.argv);
}

main().catch(async (err: unknown) => {
  // commander already printed usage errors; exitCode carries them.
  if ((err as { code?: string }).code?.startsWith("commander.")) {
    process.exitCode = (err as { exitCode?: number }).exitCode ?? 1;
    return;
  }
  reportError(err);
  await flushSentry();
  process.exitCode = 1;
});
