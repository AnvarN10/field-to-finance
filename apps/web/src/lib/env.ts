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
  SENTRY_ENVIRONMENT: z.preprocess(blank, z.string().default("development")),
  FAUCET_USDC: z.preprocess(blank, z.coerce.number().int().positive().max(100_000).default(1_000)),
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
