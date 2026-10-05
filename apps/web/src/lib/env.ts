import { z } from "zod";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm";
const TEST_USDC_MINT = "Fhfr7QZ6PpZF4ug1kVdnA7dfMGaSJawGL6dhwNMFvTjv";

/** 128-byte on-chain URI limit minus "/api/evidence/" (14) and a 64-char hash. */
export const MAX_PUBLIC_BASE_URL_LEN = 50;

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optional = z.preprocess(blank, z.string().optional());
const pubkey = (fallback: string) =>
  z.preprocess(blank, z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a base58 public key").default(fallback));
const url = (fallback: string) => z.preprocess(blank, z.url().default(fallback));

export const serverEnvSchema = z.object({
  SOLANA_RPC_URL: url(DEVNET_RPC),
  SOLANA_CLUSTER: z.preprocess(blank, z.enum(["devnet", "localnet"]).default("devnet")),
  F2F_PROGRAM_ID: pubkey(PROGRAM_ID),
  USDC_MINT: pubkey(TEST_USDC_MINT),
  F2F_DEPLOYER_KEYPAIR: optional,
  F2F_ISSUER_KEYPAIR: optional,
  F2F_COMPLIANCE_KEYPAIR: optional,
  SCAS_SECRET_KEY: optional,
  /** ADR 0013 gas sponsor: fee payer and rent payer for user transactions. */
  F2F_SPONSOR_KEYPAIR: optional,
  /** Expected FeeConfig.treasury; the admin console flags a mismatch with the chain. */
  F2F_TREASURY: z.preprocess(blank, z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "must be a base58 public key").optional()),
  BUCKET_NAME: optional,
  BUCKET_ENDPOINT: z.preprocess(blank, z.url().optional()),
  BUCKET_REGION: z.preprocess(blank, z.string().default("auto")),
  BUCKET_ACCESS_KEY_ID: optional,
  BUCKET_SECRET_ACCESS_KEY: optional,
  BUCKET_FORCE_PATH_STYLE: z
    .preprocess(blank, z.enum(["true", "false"]).default("false"))
    .transform((v) => v === "true"),
  PUBLIC_BASE_URL: url("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, ""))
    .refine((v) => v.length <= MAX_PUBLIC_BASE_URL_LEN, {
      message: `must be at most ${MAX_PUBLIC_BASE_URL_LEN} characters so evidence URIs fit the program's 128-byte limit`,
    }),
  ADMIN_PASSWORD: z.preprocess(blank, z.string().min(8, "must be at least 8 characters").optional()),
  /** Postgres for the cabinets (spec 2026-10-05); Railway reference variable in production. */
  DATABASE_URL: z.preprocess(blank, z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL").optional()),
  /** Privy server verification (ADR 0016); the app id is public, the secret is not. */
  NEXT_PUBLIC_PRIVY_APP_ID: optional,
  PRIVY_APP_SECRET: optional,
  /** Comma-separated emails that get the arranger role on first sign-in. */
  ARRANGER_EMAILS: optional,
  /** Local screenshots only: accept `dev:<email>` tokens. Ignored when NODE_ENV is production. */
  F2F_DEV_AUTH: z
    .preprocess(blank, z.enum(["1", "0", "true", "false"]).default("0"))
    .transform((v) => v === "1" || v === "true"),
  SENTRY_ENVIRONMENT: z.preprocess(blank, z.string().default("development")),
  FAUCET_USDC: z.preprocess(blank, z.coerce.number().int().positive().max(100_000).default(1_000)),
  /** SOL top-up from the faucet. Off by default: the sponsor pays gas (ADR 0013). */
  FAUCET_SOL: z
    .preprocess(blank, z.enum(["true", "false"]).default("false"))
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function issues(error: z.ZodError): string {
  // Zod messages never contain the input value; keep it that way (no custom messages with values).
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const r = serverEnvSchema.safeParse(source);
  if (!r.success) throw new Error(`Invalid server environment: ${issues(r.error)}`);
  return r.data;
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SOLANA_RPC_URL: url(DEVNET_RPC),
  NEXT_PUBLIC_SOLANA_CLUSTER: z.preprocess(blank, z.enum(["devnet", "localnet"]).default("devnet")),
  NEXT_PUBLIC_PRIVY_APP_ID: optional,
  NEXT_PUBLIC_POSTHOG_KEY: optional,
  NEXT_PUBLIC_POSTHOG_HOST: url("https://eu.i.posthog.com"),
  NEXT_PUBLIC_APP_ENV: z.preprocess(blank, z.enum(["dev", "prod"]).default("dev")),
  NEXT_PUBLIC_SENTRY_DSN: optional,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const r = publicEnvSchema.safeParse(source);
  if (!r.success) throw new Error(`Invalid public environment: ${issues(r.error)}`);
  return r.data;
}
