import { MAX_EVIDENCE_URI_LEN } from "@f2f/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { z } from "zod";

/** Length of "/e/" plus a 64-char hex SHA-256: the path every evidence URI ends with. */
const EVIDENCE_PATH_LEN = 3 + 64;

export function parseSecretKey(raw: string): Keypair {
  const value = raw.trim();
  let bytes: Uint8Array;
  try {
    if (value.startsWith("[")) {
      const arr: unknown = JSON.parse(value);
      if (!Array.isArray(arr) || !arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
        throw new Error("not a byte array");
      }
      bytes = Uint8Array.from(arr as number[]);
    } else {
      bytes = bs58.decode(value);
    }
  } catch {
    throw new Error("SCAS_SECRET_KEY is neither a base58 string nor a JSON byte array");
  }
  if (bytes.length !== 64) throw new Error(`SCAS_SECRET_KEY must decode to 64 bytes, got ${bytes.length}`);
  try {
    return Keypair.fromSecretKey(bytes);
  } catch {
    throw new Error("SCAS_SECRET_KEY is not a valid ed25519 secret key");
  }
}

const EnvSchema = z.object({
  CDSE_CLIENT_ID: z.string().min(1),
  CDSE_CLIENT_SECRET: z.string().min(1),
  SOLANA_RPC_URL: z.url(),
  SOLANA_CLUSTER: z.enum(["devnet", "localnet", "mainnet-beta"]).default("devnet"),
  SCAS_SECRET_KEY: z.string().min(1),
  F2F_PROGRAM_ID: z.string().min(32).max(44),
  BUCKET_NAME: z.string().min(1),
  BUCKET_ENDPOINT: z.url(),
  BUCKET_REGION: z.string().min(1).default("auto"),
  BUCKET_ACCESS_KEY_ID: z.string().min(1),
  BUCKET_SECRET_ACCESS_KEY: z.string().min(1),
  BUCKET_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
  EVIDENCE_BASE_URL: z.url(),
  WORKER_API_TOKEN: z.string().min(32),
  SENTRY_DSN: z.url().optional(),
  SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
});

const CdseSchema = EnvSchema.pick({ CDSE_CLIENT_ID: true, CDSE_CLIENT_SECRET: true });

export interface Config {
  cdse: { clientId: string; clientSecret: string };
  solana: { rpcUrl: string; cluster: "devnet" | "localnet" | "mainnet-beta"; programId: PublicKey };
  scas: Keypair;
  bucket: {
    name: string;
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  evidenceBaseUrl: string;
  apiToken: string;
  sentry: { dsn: string | undefined; environment: string };
  port: number;
}

type Env = Record<string, string | undefined>;

/** Railway and dotenv files often set unused variables to "", which should mean "unset". */
function withoutEmpty(env: Env): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""),
  );
}

function fail(issues: { path: PropertyKey[] }[]): never {
  const names = [...new Set(issues.map((i) => i.path.map(String).join(".")))].join(", ");
  throw new Error(`invalid environment: ${names}`);
}

export function loadCdseConfig(env: Env = process.env): Config["cdse"] {
  const parsed = CdseSchema.safeParse(withoutEmpty(env));
  if (!parsed.success) fail(parsed.error.issues);
  return { clientId: parsed.data.CDSE_CLIENT_ID, clientSecret: parsed.data.CDSE_CLIENT_SECRET };
}

export function loadConfig(env: Env = process.env): Config {
  const parsed = EnvSchema.safeParse(withoutEmpty(env));
  if (!parsed.success) fail(parsed.error.issues);
  const e = parsed.data;

  const evidenceBaseUrl = e.EVIDENCE_BASE_URL.replace(/\/+$/, "");
  if (evidenceBaseUrl.length + EVIDENCE_PATH_LEN > MAX_EVIDENCE_URI_LEN) {
    throw new Error(
      `invalid environment: EVIDENCE_BASE_URL must be at most ${MAX_EVIDENCE_URI_LEN - EVIDENCE_PATH_LEN} characters`,
    );
  }

  let programId: PublicKey;
  try {
    programId = new PublicKey(e.F2F_PROGRAM_ID);
  } catch {
    throw new Error("invalid environment: F2F_PROGRAM_ID");
  }

  return {
    cdse: { clientId: e.CDSE_CLIENT_ID, clientSecret: e.CDSE_CLIENT_SECRET },
    solana: { rpcUrl: e.SOLANA_RPC_URL, cluster: e.SOLANA_CLUSTER, programId },
    scas: parseSecretKey(e.SCAS_SECRET_KEY),
    bucket: {
      name: e.BUCKET_NAME,
      endpoint: e.BUCKET_ENDPOINT,
      region: e.BUCKET_REGION,
      accessKeyId: e.BUCKET_ACCESS_KEY_ID,
      secretAccessKey: e.BUCKET_SECRET_ACCESS_KEY,
      forcePathStyle: e.BUCKET_FORCE_PATH_STYLE === "true",
    },
    evidenceBaseUrl,
    apiToken: e.WORKER_API_TOKEN,
    sentry: { dsn: e.SENTRY_DSN, environment: e.SENTRY_ENVIRONMENT },
    port: e.PORT,
  };
}
