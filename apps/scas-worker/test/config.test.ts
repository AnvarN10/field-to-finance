import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { loadCdseConfig, loadConfig, parseSecretKey } from "../src/config";

const scas = Keypair.generate();
const ENV = {
  CDSE_CLIENT_ID: "client-id",
  CDSE_CLIENT_SECRET: "client-secret",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  SCAS_SECRET_KEY: bs58.encode(scas.secretKey),
  F2F_PROGRAM_ID: "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm",
  BUCKET_NAME: "f2f-evidence-abc123",
  BUCKET_ENDPOINT: "https://t3.storageapi.dev",
  BUCKET_ACCESS_KEY_ID: "ak",
  BUCKET_SECRET_ACCESS_KEY: "sk",
  EVIDENCE_BASE_URL: "https://scas.example.app/",
  WORKER_API_TOKEN: "t".repeat(32),
  SENTRY_DSN: "",
};

describe("parseSecretKey", () => {
  it("accepts base58 and JSON byte arrays", () => {
    expect(parseSecretKey(bs58.encode(scas.secretKey)).publicKey.equals(scas.publicKey)).toBe(true);
    expect(parseSecretKey(JSON.stringify(Array.from(scas.secretKey))).publicKey.equals(scas.publicKey)).toBe(true);
  });

  it("never echoes the secret in its error", () => {
    const secret = "notbase58!!" + "x".repeat(40);
    expect(() => parseSecretKey(secret)).toThrow(/neither a base58 string nor a JSON byte array/);
    try {
      parseSecretKey(secret);
    } catch (err) {
      expect((err as Error).message).not.toContain(secret);
    }
    expect(() => parseSecretKey(bs58.encode(new Uint8Array(32)))).toThrow(/64 bytes, got 32/);
  });
});

describe("loadConfig", () => {
  it("parses a complete environment with defaults", () => {
    const config = loadConfig(ENV);
    expect(config.scas.publicKey.equals(scas.publicKey)).toBe(true);
    expect(config.solana.cluster).toBe("devnet");
    expect(config.bucket.region).toBe("auto");
    expect(config.bucket.forcePathStyle).toBe(false);
    expect(config.evidenceBaseUrl).toBe("https://scas.example.app");
    expect(config.sentry.dsn).toBeUndefined();
    expect(config.port).toBe(8080);
  });

  it("names missing variables without printing values", () => {
    const { CDSE_CLIENT_SECRET: _omit, ...rest } = ENV;
    expect(() => loadConfig({ ...rest, WORKER_API_TOKEN: "short" })).toThrow(/CDSE_CLIENT_SECRET.*WORKER_API_TOKEN|WORKER_API_TOKEN.*CDSE_CLIENT_SECRET/);
  });

  it("rejects a base URL that cannot fit a 128-byte evidence URI", () => {
    const longBase = `https://${"a".repeat(60)}.app`;
    expect(() => loadConfig({ ...ENV, EVIDENCE_BASE_URL: longBase })).toThrow(/EVIDENCE_BASE_URL/);
  });

  it("loads only the CDSE credentials for the stats command", () => {
    expect(loadCdseConfig({ CDSE_CLIENT_ID: "a", CDSE_CLIENT_SECRET: "b" })).toEqual({ clientId: "a", clientSecret: "b" });
  });
});
