import { describe, expect, it } from "vitest";
import { MAX_PUBLIC_BASE_URL_LEN, parsePublicEnv, parseServerEnv } from "../src/lib/env";

describe("parseServerEnv", () => {
  it("fills devnet defaults", () => {
    const env = parseServerEnv({});
    expect(env.SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
    expect(env.F2F_PROGRAM_ID).toBe("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");
    expect(env.USDC_MINT).toBe("Fhfr7QZ6PpZF4ug1kVdnA7dfMGaSJawGL6dhwNMFvTjv");
    expect(env.PUBLIC_BASE_URL).toBe("http://localhost:3000");
    expect(env.BUCKET_FORCE_PATH_STYLE).toBe(false);
    // ADR 0013: users need no SOL, so the faucet sends test USDC only unless FAUCET_SOL=true.
    expect(env.FAUCET_SOL).toBe(false);
    expect(env.F2F_SPONSOR_KEYPAIR).toBeUndefined();
    expect(env.F2F_TREASURY).toBeUndefined();
  });

  it("parses FAUCET_SOL and F2F_TREASURY", () => {
    const t = "CUAToHz2ZFs5WtuL826CUXBQcHiUcU37vEDo3CCXQPwF";
    const env = parseServerEnv({ FAUCET_SOL: "true", F2F_TREASURY: t });
    expect(env.FAUCET_SOL).toBe(true);
    expect(env.F2F_TREASURY).toBe(t);
    expect(() => parseServerEnv({ F2F_TREASURY: "nope" })).toThrow(/F2F_TREASURY/);
  });

  it("treats blank strings as unset", () => {
    const env = parseServerEnv({ PRIVY_APP_SECRET: "  ", SOLANA_RPC_URL: "" });
    expect(env.PRIVY_APP_SECRET).toBeUndefined();
    expect(env.SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
  });

  it("strips a trailing slash from PUBLIC_BASE_URL", () => {
    expect(parseServerEnv({ PUBLIC_BASE_URL: "https://f2f.example/" }).PUBLIC_BASE_URL).toBe("https://f2f.example");
  });

  it("rejects a PUBLIC_BASE_URL that would push evidence URIs past 128 bytes", () => {
    const long = `https://${"a".repeat(MAX_PUBLIC_BASE_URL_LEN)}.app`;
    expect(() => parseServerEnv({ PUBLIC_BASE_URL: long })).toThrow(/PUBLIC_BASE_URL/);
  });

  it("rejects a malformed program id", () => {
    expect(() => parseServerEnv({ F2F_PROGRAM_ID: "not-a-key" })).toThrow(/F2F_PROGRAM_ID/);
  });

  it("reads the cabinet settings: DATABASE_URL, Privy secret, ARRANGER_EMAILS, dev auth off by default", () => {
    const env = parseServerEnv({ DATABASE_URL: "postgres://u:p@h:5432/db", PRIVY_APP_SECRET: "s", ARRANGER_EMAILS: "a@example.com", NEXT_PUBLIC_PRIVY_APP_ID: "app" });
    expect(env.DATABASE_URL).toBe("postgres://u:p@h:5432/db");
    expect(env.PRIVY_APP_SECRET).toBe("s");
    expect(env.ARRANGER_EMAILS).toBe("a@example.com");
    expect(env.NEXT_PUBLIC_PRIVY_APP_ID).toBe("app");
    expect(parseServerEnv({}).F2F_DEV_AUTH).toBe(false);
    expect(parseServerEnv({ F2F_DEV_AUTH: "1" }).F2F_DEV_AUTH).toBe(true);
  });

  it("rejects a DATABASE_URL that is not a Postgres URL without echoing it", () => {
    let message = "";
    try {
      parseServerEnv({ DATABASE_URL: "mysql://secret@h/db" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain("secret");
  });

  it("parses BUCKET_FORCE_PATH_STYLE", () => {
    expect(parseServerEnv({ BUCKET_FORCE_PATH_STYLE: "true" }).BUCKET_FORCE_PATH_STYLE).toBe(true);
  });
});

describe("parsePublicEnv", () => {
  it("defaults to devnet, EU PostHog and app_env dev", () => {
    const env = parsePublicEnv({});
    expect(env.NEXT_PUBLIC_SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
    expect(env.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://eu.i.posthog.com");
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("dev");
    expect(env.NEXT_PUBLIC_PRIVY_APP_ID).toBeUndefined();
  });

  it("rejects an unknown app env", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_ENV: "staging" })).toThrow(/NEXT_PUBLIC_APP_ENV/);
  });
});
