# SCAS Worker Implementation Plan

> **Status: stopped 2026-10-03.** SCAS will be an external provider; the MVP uses a stub in the web app. Tasks 1–2 (`packages/sdk`) are merged into `main`. Tasks 3–13 (Sentinel/CDSE worker) live only on branch `feat/scas-worker` as groundwork for a future integration.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/scas-worker`, a TypeScript service that pulls Sentinel-2 NDVI statistics for a Field polygon from the Copernicus Data Space Ecosystem, computes a verdict, stores the evidence in a Railway bucket under its SHA-256 hash, and signs `record_attestation` with the SCAS key. Build `packages/sdk` alongside it for the PDA helpers, the polygon hash and the IDL that the web app also needs.

**Architecture:** A single process with two entry points, a CLI and a Hono HTTP server, over one orchestrator, `runAttestation`. The orchestrator reads the Field from the Program, loads the polygon from the bucket (content-addressed by the on-chain polygon hash), asks the Statistical API for daily NDVI statistics with SCL cloud masking, applies versioned demo rules, writes the evidence document, and only then sends the transaction. Every external dependency (Statistical API, bucket, chain) sits behind a small interface so tests run offline on recorded-shape fixtures.

**Tech Stack:** Node 22, pnpm 12, Nx 23, TypeScript 6.0.3, `@anchor-lang/core` 1.2.0 with `@solana/web3.js` 1.99.0, Hono 4.13.12 on `@hono/node-server` 2.1.3, zod 4.6.5, `@aws-sdk/client-s3` 3.1146.0, `@turf/area` and `@turf/kinks` 7.4.0, `@noble/hashes` 2.4.0, commander 15.0.0, `@sentry/node` 11.4.0 (GlitchTip), vitest 5.0.3 with vite 8.3.2, tsup 8.5.1, tsx 4.23.15.

**Spec:** [docs/specs/2026-10-03-mvp-design.md](../specs/2026-10-03-mvp-design.md), sections 4, 4.4, 6 and 7. Program interface: [docs/systems/program.md](../systems/program.md) and `anchor/programs/f2f/src/instructions/record_attestation.rs`.

**Prerequisite:** the program from [the program plan](2026-10-03-program.md) is built (`anchor/target/idl/f2f.json` and `anchor/target/types/f2f.ts` exist; program id `9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm`). Work on a branch off `feat/program` or off `main` after it is merged.

## Global Constraints

- Deadline 2026-10-12 23:59 PT. Commit small, push daily, never squash or rewrite pushed history. Add a devlog entry for each working day.
- Docs in English; update `docs/` in the same commit as behavior changes.
- Never commit secrets. Secrets live in Infisical, organization `personal`, and are synced to Railway variables. Never print a secret value in logs, errors or evidence.
- Errors go to GlitchTip, organization `personal` (`SENTRY_DSN`, Sentry-compatible SDK).
- Data source: Sentinel Hub Statistical API on CDSE. Token URL `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`; Statistical API `https://sh.dataspace.copernicus.eu/statistics/v1`.
- CDSE free tier (Copernicus General User, Sentinel Hub APIs): 10 000 requests/month, 300 requests/minute, 10 000 PU/month, 300 PU/minute. Tests never call the real API.
- Cloud rule from the spec: a scene with more than 30% cloud over the polygon is skipped, so a scene counts as clear when at least 70% of polygon pixels are clear. No clear scene in the window gives `InsufficientData`.
- `FieldVerified` = polygon valid AND computed area within 5% of the declared area AND at least one clear scene in the last 90 days. `FieldVerified` always uses current imagery.
- `Sowing`, `Vegetation`, `Harvest` for the demo replay the same fields' 2026 season with `--replay-date`; the evidence carries `replay: true`.
- The Program limits: `evidence_uri` at most 128 bytes, `ndvi_mean_x10k` in −10 000..10 000, Field index is a `u8`, Attestation PDA seeds `["attestation", field, attestation_count u32 LE]`.
- The worker never sends a transaction after a failed or unparseable Statistical API request.
- Railway buckets are private and public buckets are not supported, so evidence is served through the worker at `GET /e/<hash>`.
- `@anchor-lang/core` 1.2.0 ships CommonJS only: import `AnchorProvider`, `Program`, `Wallet` by name, and import `BN` from `bn.js` (the named `BN` export is not visible to Node ESM).

## Review Focus

- **Two attestation requests for the same Field at once** (double click in the admin view, or CLI and HTTP together). Both read the same `attestation_count`, so the second transaction would fail on an existing PDA. Expected: requests are serialized in the process and both land with consecutive sequences. Test: `createSerialQueue` ordering test in Task 9.
- **SCAS key in Railway differs from `Config.scas` on devnet.** Expected: a clear error naming both keys before any transaction, not an opaque `Unauthorized` simulation failure. Test: `checkScasAuthority` in Task 9.
- **The web app hashes the same field differently** (Feature vs bare geometry, altitude in positions, unclosed ring, extra decimals). Expected: the same polygon hash, so the worker finds the stored polygon and the on-chain hash matches. Test: normalization cases in Task 1.
- **`EVIDENCE_BASE_URL` too long for the 128-byte on-chain URI.** Expected: the worker refuses to start with a message naming the variable, instead of failing every transaction. Test: config test in Task 3.
- **Secrets leaking through error messages or evidence.** Expected: a malformed `SCAS_SECRET_KEY` produces an error without its value; stored evidence never contains the CDSE token. Tests: config test in Task 3, evidence check in Task 10.

---

## File Structure

```
pnpm-workspace.yaml                    fix the allowBuilds placeholder (Task 3)
.dockerignore                          build context filter for the worker image (Task 13)
packages/sdk/
  package.json, project.json, tsconfig.json, vitest.config.ts
  scripts/sync-idl.mjs                 copies anchor/target IDL and types into src/idl
  src/index.ts                         public exports
  src/constants.ts                     limits mirrored from the program
  src/canonical.ts                     canonical JSON, sha256, hex
  src/polygon.ts                       polygon normalization and polygon hash
  src/pda.ts                           PDA helpers mirroring program seeds
  src/enums.ts                         AttestationKind / Verdict names and Anchor enum mapping
  src/program.ts                       IDL and F2f type re-export, program id
  src/idl/f2f.json, src/idl/f2f.ts     generated by anchor build, committed copies
  test/*.test.ts
apps/scas-worker/
  package.json, project.json, tsconfig.json, vitest.config.ts, tsup.config.ts
  Dockerfile, .env.example
  src/errors.ts                        RequestError, SentinelError
  src/config.ts                        env schema, SCAS key parsing
  src/geometry.ts                      polygon validity and geodesic area
  src/sentinel/evalscript.ts           NDVI + SCL mask evalscript
  src/sentinel/request.ts              time windows, resolution, request body
  src/sentinel/parse.ts                response parser to Observations
  src/sentinel/client.ts               token cache, retries, StatsSource
  src/rules/crops.ts                   crop calendar table (demo assumption)
  src/rules/verdict.ts                 verdict rules, rule version, windows
  src/evidence.ts                      evidence document, hash, URI, on-chain scaling
  src/store.ts                         BlobStore, MemoryStore, S3Store
  src/chain.ts                         Program client, Field reads, serialized sends
  src/polygons.ts                      polygon upload
  src/attest.ts                        runAttestation orchestrator
  src/http.ts                          Hono app: /health, /attest, /polygons, /e/:hash
  src/sentry.ts                        GlitchTip reporting
  src/cli.ts                           commander CLI
  src/main.ts                          entry point, wiring
  test/fixtures/*.json                 Statistical API responses
  test/helpers.ts                      shared test polygons and fakes
  test/*.test.ts
docs/systems/scas.md                   system doc (Task 15)
docs/flows/field-verification.md       flow doc (Task 15)
```

---

### Task 1: `packages/sdk` core: canonical JSON, polygon hash, PDAs, enums

**Files:**
- Create: `packages/sdk/package.json`, `packages/sdk/project.json`, `packages/sdk/tsconfig.json`, `packages/sdk/vitest.config.ts`
- Create: `packages/sdk/src/index.ts`, `src/constants.ts`, `src/canonical.ts`, `src/polygon.ts`, `src/pda.ts`, `src/enums.ts`
- Test: `packages/sdk/test/canonical.test.ts`, `test/polygon.test.ts`, `test/pda.test.ts`, `test/enums.test.ts`

**Interfaces:**
- Produces: `canonicalJson(value: unknown): string`, `sha256(data: string | Uint8Array): Uint8Array`, `toHex(bytes: Uint8Array): string`; `type Position = [number, number]`, `interface PolygonGeometry { type: "Polygon"; coordinates: Position[][] }`, `class PolygonFormatError`, `normalizePolygon(input: unknown): PolygonGeometry`, `polygonHash(input: unknown): Uint8Array`, `polygonHashHex(input: unknown): string`; `configPda(programId)`, `projectPda(programId, producer, projectId: bigint | number)`, `fieldPda(programId, project, index: number)`, `attestationPda(programId, field, sequence: number)`, `poolPda(programId, poolId: bigint | number)`, `mintPda(programId, pool)`, `investorPda(programId, wallet)` all returning `PublicKey`; `ATTESTATION_KINDS`, `type AttestationKindName`, `VERDICTS`, `type VerdictName`, `type AnchorEnum`, `toAnchorEnum(name: string): AnchorEnum`, `kindFromAnchor(v: unknown)`, `verdictFromAnchor(v: unknown)`, `parseKind(input: string): AttestationKindName`; constants `MAX_EVIDENCE_URI_LEN = 128`, `NDVI_SCALE = 10_000`.

- [ ] **Step 1: Create the package skeleton**

`packages/sdk/package.json`:
```json
{
  "name": "@f2f/sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "sync-idl": "node scripts/sync-idl.mjs"
  },
  "dependencies": {
    "@noble/hashes": "2.4.0",
    "@solana/web3.js": "1.99.0"
  },
  "devDependencies": {
    "@types/node": "22.20.5",
    "typescript": "6.0.3",
    "vite": "8.3.2",
    "vitest": "5.0.3"
  }
}
```

`packages/sdk/project.json`:
```json
{
  "name": "sdk",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "sourceRoot": "packages/sdk/src",
  "targets": {
    "test": {
      "executor": "nx:run-commands",
      "dependsOn": [],
      "options": { "command": "pnpm exec vitest run", "cwd": "packages/sdk" }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm exec tsc --noEmit", "cwd": "packages/sdk" }
    }
  }
}
```

`packages/sdk/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/sdk/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
```

Run: `pnpm install`
Expected: `packages/sdk/node_modules/vitest` exists.

- [ ] **Step 2: Write the failing tests**

`packages/sdk/test/canonical.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, toHex } from "../src/canonical";

describe("canonicalJson", () => {
  it("sorts object keys recursively and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: "x" } })).toBe('{"a":{"c":"x","d":[3,1]},"b":1}');
  });

  it("drops undefined properties and keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("escapes strings exactly like JSON.stringify", () => {
    expect(canonicalJson({ s: 'He said "hi"\n' })).toBe(`{"s":${JSON.stringify('He said "hi"\n')}}`);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/non-finite/);
  });
});

describe("sha256", () => {
  it("matches the FIPS 180-2 test vector", () => {
    expect(toHex(sha256("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
```

`packages/sdk/test/polygon.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical";
import { PolygonFormatError, normalizePolygon, polygonHashHex } from "../src/polygon";

const SQUARE = {
  type: "Polygon",
  coordinates: [[[69, 52], [69.01, 52], [69.01, 52.01], [69, 52.01], [69, 52]]],
};

describe("normalizePolygon", () => {
  it("produces the canonical form that is hashed", () => {
    expect(canonicalJson(normalizePolygon(SQUARE))).toBe(
      '{"coordinates":[[[69,52],[69.01,52],[69.01,52.01],[69,52.01],[69,52]]],"type":"Polygon"}',
    );
  });

  it("gives the same hash for a Feature, a one-feature FeatureCollection and the bare geometry", () => {
    const feature = { type: "Feature", properties: { name: "pilot-1" }, geometry: SQUARE };
    const collection = { type: "FeatureCollection", features: [feature] };
    expect(polygonHashHex(feature)).toBe(polygonHashHex(SQUARE));
    expect(polygonHashHex(collection)).toBe(polygonHashHex(SQUARE));
  });

  it("drops altitude, closes an open ring and rounds to 7 decimals", () => {
    const messy = {
      type: "Polygon",
      coordinates: [[[69.00000001, 52, 310], [69.01, 52, 305], [69.01, 52.01], [69, 52.01]]],
    };
    expect(polygonHashHex(messy)).toBe(polygonHashHex(SQUARE));
  });

  it("changes the hash when the boundary changes", () => {
    const moved = { ...SQUARE, coordinates: [[[69, 52], [69.02, 52], [69.02, 52.01], [69, 52.01], [69, 52]]] };
    expect(polygonHashHex(moved)).not.toBe(polygonHashHex(SQUARE));
  });

  it("rejects non-Polygon geometries and malformed rings", () => {
    expect(() => normalizePolygon({ type: "MultiPolygon", coordinates: [] })).toThrow(PolygonFormatError);
    expect(() => normalizePolygon({ type: "FeatureCollection", features: [{}, {}] })).toThrow(/exactly one/);
    expect(() => normalizePolygon({ type: "Polygon", coordinates: [[[69, 52], [69.01, 52], [69, 52]]] })).toThrow(/at least 4/);
    expect(() => normalizePolygon({ type: "Polygon", coordinates: [[[69, "52"], [69.01, 52], [69.01, 52.01], [69, 52]]] })).toThrow(/lon, lat/);
  });
});
```

`packages/sdk/test/pda.test.ts`:
```ts
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { attestationPda, configPda, fieldPda, investorPda, mintPda, poolPda, projectPda } from "../src/pda";

const PROGRAM = new PublicKey("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");
const find = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM)[0];

describe("PDA helpers mirror the program seeds", () => {
  const key = Keypair.generate().publicKey;

  it("config", () => {
    expect(configPda(PROGRAM).equals(find([Buffer.from("config")]))).toBe(true);
  });

  it("project uses a u64 little-endian id", () => {
    const id = Buffer.from([7, 1, 0, 0, 0, 0, 0, 0]);
    expect(projectPda(PROGRAM, key, 263n).equals(find([Buffer.from("project"), key.toBuffer(), id]))).toBe(true);
  });

  it("field uses a single index byte", () => {
    expect(fieldPda(PROGRAM, key, 1).equals(find([Buffer.from("field"), key.toBuffer(), Buffer.from([1])]))).toBe(true);
  });

  it("attestation uses a u32 little-endian sequence", () => {
    const seq = Buffer.from([2, 1, 0, 0]);
    expect(attestationPda(PROGRAM, key, 258).equals(find([Buffer.from("attestation"), key.toBuffer(), seq]))).toBe(true);
  });

  it("pool, mint and investor", () => {
    const poolId = Buffer.from([5, 0, 0, 0, 0, 0, 0, 0]);
    const pool = poolPda(PROGRAM, 5);
    expect(pool.equals(find([Buffer.from("pool"), poolId]))).toBe(true);
    expect(mintPda(PROGRAM, pool).equals(find([Buffer.from("mint"), pool.toBuffer()]))).toBe(true);
    expect(investorPda(PROGRAM, key).equals(find([Buffer.from("investor"), key.toBuffer()]))).toBe(true);
  });

  it("rejects out-of-range integers", () => {
    expect(() => fieldPda(PROGRAM, key, 256)).toThrow(RangeError);
    expect(() => attestationPda(PROGRAM, key, -1)).toThrow(RangeError);
    expect(() => projectPda(PROGRAM, key, -1n)).toThrow(RangeError);
  });
});
```

`packages/sdk/test/enums.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { kindFromAnchor, parseKind, toAnchorEnum, verdictFromAnchor } from "../src/enums";

describe("enum mapping", () => {
  it("maps names to Anchor enum arguments", () => {
    expect(toAnchorEnum("FieldVerified")).toEqual({ fieldVerified: {} });
    expect(toAnchorEnum("InsufficientData")).toEqual({ insufficientData: {} });
  });

  it("maps decoded Anchor enums back to names", () => {
    expect(kindFromAnchor({ harvest: {} })).toBe("Harvest");
    expect(verdictFromAnchor({ pass: {} })).toBe("Pass");
    expect(() => verdictFromAnchor({ maybe: {} })).toThrow(/unknown enum variant/);
  });

  it("parses CLI spellings of kinds", () => {
    expect(parseKind("field-verified")).toBe("FieldVerified");
    expect(parseKind("VEGETATION")).toBe("Vegetation");
    expect(() => parseKind("rain")).toThrow(/expected one of/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -C packages/sdk exec vitest run`
Expected: FAIL, cannot resolve `../src/canonical` and the other modules.

- [ ] **Step 4: Implement**

`packages/sdk/src/constants.ts`:
```ts
/** Mirrors MAX_URI_LEN in anchor/programs/f2f/src/constants.rs. */
export const MAX_EVIDENCE_URI_LEN = 128;
/** Mirrors NDVI_SCALE: NDVI is stored on-chain as an integer times 10 000. */
export const NDVI_SCALE = 10_000;
```

`packages/sdk/src/canonical.ts`:
```ts
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * Deterministic JSON: object keys sorted by UTF-16 code units, no whitespace,
 * undefined properties dropped, numbers in JavaScript's shortest round-trip form.
 * Matches RFC 8785 (JCS) for the values this project produces.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonicalJson: non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
}

export function sha256(data: string | Uint8Array): Uint8Array {
  return nobleSha256(typeof data === "string" ? utf8ToBytes(data) : data);
}

export function toHex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}
```

`packages/sdk/src/polygon.ts`:
```ts
import { canonicalJson, sha256, toHex } from "./canonical";

export type Position = [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export class PolygonFormatError extends Error {
  override name = "PolygonFormatError";
}

/** About 1 cm at the equator; enough for field boundaries and stable across tools. */
export const COORDINATE_DECIMALS = 7;
const SCALE = 10 ** COORDINATE_DECIMALS;

function round(n: number): number {
  const r = Math.round(n * SCALE) / SCALE;
  return Object.is(r, -0) ? 0 : r;
}

function extractGeometry(input: unknown): unknown {
  if (!input || typeof input !== "object") throw new PolygonFormatError("GeoJSON must be an object");
  const obj = input as { type?: unknown; geometry?: unknown; features?: unknown };
  if (obj.type === "Feature") return obj.geometry;
  if (obj.type === "FeatureCollection") {
    if (!Array.isArray(obj.features) || obj.features.length !== 1) {
      throw new PolygonFormatError("FeatureCollection must contain exactly one feature");
    }
    return (obj.features[0] as { geometry?: unknown } | undefined)?.geometry;
  }
  return input;
}

/**
 * Reduces any accepted GeoJSON input to the canonical Polygon that is hashed:
 * Feature and one-feature FeatureCollection are unwrapped, altitude is dropped,
 * coordinates are rounded to 7 decimals, and open rings are closed.
 */
export function normalizePolygon(input: unknown): PolygonGeometry {
  const geometry = extractGeometry(input) as { type?: unknown; coordinates?: unknown } | null | undefined;
  if (!geometry || geometry.type !== "Polygon") throw new PolygonFormatError("geometry must be a GeoJSON Polygon");
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    throw new PolygonFormatError("Polygon must have at least one ring");
  }
  const rings = geometry.coordinates.map((ring: unknown, r: number) => {
    if (!Array.isArray(ring)) throw new PolygonFormatError(`ring ${r} is not an array`);
    const positions: Position[] = ring.map((p: unknown, i: number) => {
      if (
        !Array.isArray(p) ||
        p.length < 2 ||
        typeof p[0] !== "number" ||
        typeof p[1] !== "number" ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1])
      ) {
        throw new PolygonFormatError(`ring ${r} position ${i} is not [lon, lat]`);
      }
      return [round(p[0]), round(p[1])];
    });
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) positions.push([first[0], first[1]]);
    if (positions.length < 4) throw new PolygonFormatError(`ring ${r} needs at least 4 positions`);
    return positions;
  });
  return { type: "Polygon", coordinates: rings };
}

/** The value stored in Field.polygon_hash: sha256 of the canonical JSON of the normalized polygon. */
export function polygonHash(input: unknown): Uint8Array {
  return sha256(canonicalJson(normalizePolygon(input)));
}

export function polygonHashHex(input: unknown): string {
  return toHex(polygonHash(input));
}
```

`packages/sdk/src/pda.ts`:
```ts
import { PublicKey } from "@solana/web3.js";

/** Seeds from anchor/programs/f2f/src/constants.rs. */
export const SEED = {
  config: "config",
  pool: "pool",
  mint: "mint",
  project: "project",
  field: "field",
  attestation: "attestation",
  investor: "investor",
} as const;

const utf8 = (s: string) => Buffer.from(s, "utf8");

function u8(n: number): Buffer {
  if (!Number.isInteger(n) || n < 0 || n > 0xff) throw new RangeError(`u8 out of range: ${n}`);
  return Buffer.from([n]);
}

function u32le(n: number): Buffer {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError(`u32 out of range: ${n}`);
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function u64le(n: bigint | number): Buffer {
  const v = BigInt(n);
  if (v < 0n || v > 0xffffffffffffffffn) throw new RangeError(`u64 out of range: ${n}`);
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

const find = (seeds: Buffer[], programId: PublicKey) => PublicKey.findProgramAddressSync(seeds, programId)[0];

export const configPda = (programId: PublicKey) => find([utf8(SEED.config)], programId);

export const projectPda = (programId: PublicKey, producer: PublicKey, projectId: bigint | number) =>
  find([utf8(SEED.project), producer.toBuffer(), u64le(projectId)], programId);

export const fieldPda = (programId: PublicKey, project: PublicKey, index: number) =>
  find([utf8(SEED.field), project.toBuffer(), u8(index)], programId);

export const attestationPda = (programId: PublicKey, field: PublicKey, sequence: number) =>
  find([utf8(SEED.attestation), field.toBuffer(), u32le(sequence)], programId);

export const poolPda = (programId: PublicKey, poolId: bigint | number) =>
  find([utf8(SEED.pool), u64le(poolId)], programId);

export const mintPda = (programId: PublicKey, pool: PublicKey) => find([utf8(SEED.mint), pool.toBuffer()], programId);

export const investorPda = (programId: PublicKey, wallet: PublicKey) =>
  find([utf8(SEED.investor), wallet.toBuffer()], programId);
```

`packages/sdk/src/enums.ts`:
```ts
export const ATTESTATION_KINDS = ["FieldVerified", "Sowing", "Vegetation", "Harvest"] as const;
export type AttestationKindName = (typeof ATTESTATION_KINDS)[number];

export const VERDICTS = ["Pass", "Fail", "InsufficientData"] as const;
export type VerdictName = (typeof VERDICTS)[number];

/** Anchor's TS encoding of a unit enum variant, e.g. `{ fieldVerified: {} }`. */
export type AnchorEnum = Record<string, Record<string, never>>;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function toAnchorEnum(name: string): AnchorEnum {
  return { [lowerFirst(name)]: {} };
}

function fromAnchorEnum<T extends string>(value: unknown, names: readonly T[]): T {
  if (!value || typeof value !== "object") throw new TypeError("not an Anchor enum value");
  const key = Object.keys(value)[0];
  const match = names.find((n) => lowerFirst(n) === key);
  if (!match) throw new TypeError(`unknown enum variant: ${String(key)}`);
  return match;
}

export const kindFromAnchor = (value: unknown): AttestationKindName => fromAnchorEnum(value, ATTESTATION_KINDS);
export const verdictFromAnchor = (value: unknown): VerdictName => fromAnchorEnum(value, VERDICTS);

/** Accepts `FieldVerified`, `field-verified`, `field_verified`, `fieldverified` in any case. */
export function parseKind(input: string): AttestationKindName {
  const norm = input.replace(/[-_\s]/g, "").toLowerCase();
  const match = ATTESTATION_KINDS.find((k) => k.toLowerCase() === norm);
  if (!match) throw new RangeError(`unknown attestation kind "${input}"; expected one of ${ATTESTATION_KINDS.join(", ")}`);
  return match;
}
```

`packages/sdk/src/index.ts`:
```ts
export * from "./constants";
export * from "./canonical";
export * from "./polygon";
export * from "./pda";
export * from "./enums";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm -C packages/sdk exec vitest run && pnpm -C packages/sdk exec tsc --noEmit`
Expected: all tests in 4 files pass; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk pnpm-lock.yaml
git commit -m "feat(sdk): canonical JSON, polygon hash, PDA helpers, enum mapping"
```

---

### Task 2: `packages/sdk` IDL and program types

**Files:**
- Create: `packages/sdk/scripts/sync-idl.mjs`, `packages/sdk/src/program.ts`, `packages/sdk/src/idl/f2f.json`, `packages/sdk/src/idl/f2f.ts` (both generated)
- Modify: `packages/sdk/src/index.ts`, `packages/sdk/project.json`
- Test: `packages/sdk/test/program.test.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `F2F_IDL: F2f`, `F2F_PROGRAM_ID: PublicKey`, `type F2f` (camelCase IDL type generated by Anchor).

- [ ] **Step 1: Write the failing test**

`packages/sdk/test/program.test.ts`:
```ts
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { F2F_IDL, F2F_PROGRAM_ID } from "../src/program";

const BUILT_IDL = fileURLToPath(new URL("../../../anchor/target/idl/f2f.json", import.meta.url));

describe("committed IDL", () => {
  it("exposes the program id", () => {
    expect(F2F_PROGRAM_ID.toBase58()).toBe(F2F_IDL.address);
  });

  it("has record_attestation with the arguments the worker sends", () => {
    const ix = (F2F_IDL as unknown as { instructions: { name: string; args: { name: string }[] }[] }).instructions.find(
      (i) => i.name === "record_attestation",
    );
    expect(ix?.args.map((a) => a.name)).toEqual([
      "kind",
      "verdict",
      "evidence_hash",
      "evidence_uri",
      "ndvi_mean_x10k",
      "scene_date",
    ]);
  });

  it.skipIf(!existsSync(BUILT_IDL))("matches anchor/target (run `pnpm -C packages/sdk sync-idl` after anchor build)", () => {
    const built = JSON.parse(readFileSync(BUILT_IDL, "utf8")) as unknown;
    expect(F2F_IDL).toEqual(built);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/sdk exec vitest run test/program.test.ts`
Expected: FAIL, cannot resolve `../src/program`.

- [ ] **Step 3: Implement the sync script, copy the IDL, export it**

`packages/sdk/scripts/sync-idl.mjs`:
```js
// Copies the IDL and TS types produced by `anchor build` into the sdk.
// anchor/target is gitignored; the sdk keeps committed copies so Docker
// builds and the web app do not need the Rust toolchain.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../../../anchor/target");
const out = resolve(here, "../src/idl");

mkdirSync(out, { recursive: true });
copyFileSync(resolve(target, "idl/f2f.json"), resolve(out, "f2f.json"));
copyFileSync(resolve(target, "types/f2f.ts"), resolve(out, "f2f.ts"));
console.log(`IDL copied to ${out}`);
```

Add a target to `packages/sdk/project.json` inside `"targets"`:
```json
    "sync-idl": {
      "executor": "nx:run-commands",
      "dependsOn": [{ "projects": ["f2f-program"], "target": "build" }],
      "options": { "command": "node scripts/sync-idl.mjs", "cwd": "packages/sdk" }
    }
```

Run: `pnpm -C packages/sdk sync-idl`
Expected: `IDL copied to .../packages/sdk/src/idl`; `src/idl/f2f.json` and `src/idl/f2f.ts` exist.

`packages/sdk/src/program.ts`:
```ts
import { PublicKey } from "@solana/web3.js";
import idl from "./idl/f2f.json" with { type: "json" };
import type { F2f } from "./idl/f2f";

export type { F2f };

/**
 * The raw IDL as emitted by `anchor build` (snake_case names). `Program` from
 * @anchor-lang/core accepts it and exposes camelCase names typed by `F2f`.
 */
export const F2F_IDL = idl as unknown as F2f;

export const F2F_PROGRAM_ID = new PublicKey(F2F_IDL.address);
```

Append to `packages/sdk/src/index.ts`:
```ts
export * from "./program";
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm -C packages/sdk exec vitest run && pnpm -C packages/sdk exec tsc --noEmit`
Expected: all pass, including the anchor/target comparison.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk
git commit -m "feat(sdk): commit generated IDL and re-export program types"
```

---

### Task 3: Worker scaffold, errors and configuration

**Files:**
- Create: `apps/scas-worker/package.json`, `project.json`, `tsconfig.json`, `vitest.config.ts`, `tsup.config.ts`, `.env.example`
- Create: `apps/scas-worker/src/errors.ts`, `apps/scas-worker/src/config.ts`
- Modify: `pnpm-workspace.yaml` (replace the `allowBuilds` placeholder)
- Test: `apps/scas-worker/test/config.test.ts`

**Interfaces:**
- Consumes: `MAX_EVIDENCE_URI_LEN` from `@f2f/sdk`.
- Produces: `class RequestError extends Error { status: 400 | 404 | 409 | 422 }`, `class SentinelError extends Error { retryable: boolean; status?: number; retryAfterMs?: number }`, `parseSecretKey(raw: string): Keypair`, `loadConfig(env?): Config`, `loadCdseConfig(env?): { clientId: string; clientSecret: string }`, and

```ts
interface Config {
  cdse: { clientId: string; clientSecret: string };
  solana: { rpcUrl: string; cluster: "devnet" | "localnet" | "mainnet-beta"; programId: PublicKey };
  scas: Keypair;
  bucket: { name: string; endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean };
  evidenceBaseUrl: string; // no trailing slash
  apiToken: string;
  sentry: { dsn: string | undefined; environment: string };
  port: number;
}
```

- [ ] **Step 1: Create the project files**

`pnpm-workspace.yaml` — replace the placeholder block so the file reads:
```yaml
packages:
  - "apps/*"
  - "packages/*"
allowBuilds:
  nx: true
  esbuild: true
```

`apps/scas-worker/package.json`:
```json
{
  "name": "@f2f/scas-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "scas": "tsx src/main.ts",
    "start": "node dist/main.cjs serve"
  },
  "dependencies": {
    "@anchor-lang/core": "1.2.0",
    "@aws-sdk/client-s3": "3.1146.0",
    "@f2f/sdk": "workspace:*",
    "@hono/node-server": "2.1.3",
    "@sentry/node": "11.4.0",
    "@solana/web3.js": "1.99.0",
    "@turf/area": "7.4.0",
    "@turf/kinks": "7.4.0",
    "bn.js": "5.2.5",
    "bs58": "6.0.0",
    "commander": "15.0.0",
    "hono": "4.13.12",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@types/bn.js": "5.2.0",
    "@types/geojson": "7946.0.16",
    "@types/node": "22.20.5",
    "tsup": "8.5.1",
    "tsx": "4.23.15",
    "typescript": "6.0.3",
    "vite": "8.3.2",
    "vitest": "5.0.3"
  }
}
```

`apps/scas-worker/project.json`:
```json
{
  "name": "scas-worker",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "apps/scas-worker/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm exec tsup", "cwd": "apps/scas-worker" },
      "outputs": ["{projectRoot}/dist"]
    },
    "test": {
      "executor": "nx:run-commands",
      "dependsOn": [],
      "options": { "command": "pnpm exec vitest run", "cwd": "apps/scas-worker" }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm exec tsc --noEmit", "cwd": "apps/scas-worker" }
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm exec tsx src/main.ts serve", "cwd": "apps/scas-worker" }
    }
  }
}
```

`apps/scas-worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test", "vitest.config.ts", "tsup.config.ts"]
}
```

`apps/scas-worker/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
```

`apps/scas-worker/tsup.config.ts`:
```ts
import { defineConfig } from "tsup";

// One CommonJS bundle. The sdk is TypeScript source in the workspace, so it is
// bundled together with its own dependency; everything else stays in node_modules.
export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ["@f2f/sdk", "@noble/hashes"],
});
```

`apps/scas-worker/.env.example`:
```bash
# Copy to .env for local runs, or run through `infisical run --env=dev --path=/scas-worker -- ...`.
# Never commit real values.
CDSE_CLIENT_ID=
CDSE_CLIENT_SECRET=
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
# base58 secret key or the JSON byte array from solana-keygen
SCAS_SECRET_KEY=
F2F_PROGRAM_ID=9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm
BUCKET_NAME=
BUCKET_ENDPOINT=https://t3.storageapi.dev
BUCKET_REGION=auto
BUCKET_ACCESS_KEY_ID=
BUCKET_SECRET_ACCESS_KEY=
BUCKET_FORCE_PATH_STYLE=false
# Public origin of this worker; evidence URIs are <base>/e/<sha256>. At most 61 characters.
EVIDENCE_BASE_URL=http://localhost:8080
# At least 32 characters: openssl rand -hex 32
WORKER_API_TOKEN=
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
PORT=8080
```

Run: `pnpm install`
Expected: `apps/scas-worker/node_modules/@f2f/sdk` is a symlink to `packages/sdk`.

- [ ] **Step 2: Write the failing test**

`apps/scas-worker/test/config.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/config.test.ts`
Expected: FAIL, cannot resolve `../src/config`.

- [ ] **Step 4: Implement**

`apps/scas-worker/src/errors.ts`:
```ts
/** A problem with the caller's request. Never retried, never reported as a crash. */
export class RequestError extends Error {
  override name = "RequestError";
  readonly status: 400 | 404 | 409 | 422;

  constructor(message: string, status: 400 | 404 | 409 | 422 = 400) {
    super(message);
    this.status = status;
  }
}

export interface SentinelErrorOptions {
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
}

/** The Statistical API or the CDSE token endpoint failed. No Attestation may be signed. */
export class SentinelError extends Error {
  override name = "SentinelError";
  readonly retryable: boolean;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, opts: SentinelErrorOptions) {
    super(message, { cause: opts.cause });
    this.retryable = opts.retryable;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}
```

`apps/scas-worker/src/config.ts`:
```ts
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
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm -C apps/scas-worker exec vitest run test/config.test.ts && pnpm -C apps/scas-worker exec tsc --noEmit`
Expected: 6 tests pass; tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml apps/scas-worker
git commit -m "feat(scas): worker scaffold and environment config"
```

---

### Task 4: Geometry checks and geodesic area

**Files:**
- Create: `apps/scas-worker/src/geometry.ts`, `apps/scas-worker/test/helpers.ts`
- Test: `apps/scas-worker/test/geometry.test.ts`

**Interfaces:**
- Consumes: `PolygonGeometry`, `normalizePolygon` from `@f2f/sdk`.
- Produces: `MAX_FIELD_AREA_HA = 20_000`, `interface GeometryCheck { valid: boolean; areaHa: number; reasons: string[] }`, `checkPolygon(polygon: PolygonGeometry): GeometryCheck`, `areaMismatch(computedHa: number, declaredHa: number): number` (relative difference, 0.05 = 5%). Test helpers: `SQUARE` (76.11 ha near 52°N 69°E), `BOWTIE`.

- [ ] **Step 1: Write the failing test and shared helpers**

`apps/scas-worker/test/helpers.ts`:
```ts
import { normalizePolygon, type PolygonGeometry } from "@f2f/sdk";

/** 0.01° x 0.01° near Astana: 76.11 ha geodesic area. */
export const SQUARE: PolygonGeometry = normalizePolygon({
  type: "Polygon",
  coordinates: [[[69, 52], [69.01, 52], [69.01, 52.01], [69, 52.01], [69, 52]]],
});

/** Self-intersecting ring. */
export const BOWTIE: PolygonGeometry = normalizePolygon({
  type: "Polygon",
  coordinates: [[[69, 52], [69.01, 52.01], [69.01, 52], [69, 52.01], [69, 52]]],
});

export const SQUARE_AREA_HA_X100 = 7611;
```

`apps/scas-worker/test/geometry.test.ts`:
```ts
import { normalizePolygon } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { areaMismatch, checkPolygon } from "../src/geometry";
import { BOWTIE, SQUARE } from "./helpers";

describe("checkPolygon", () => {
  it("accepts a simple field and computes geodesic hectares", () => {
    const check = checkPolygon(SQUARE);
    expect(check.valid).toBe(true);
    expect(check.areaHa).toBeCloseTo(76.11, 2);
    expect(check.reasons).toEqual([]);
  });

  it("accepts a field with a hole and subtracts it", () => {
    const holed = normalizePolygon({
      type: "Polygon",
      coordinates: [
        [[69, 52], [69.01, 52], [69.01, 52.01], [69, 52.01], [69, 52]],
        [[69.002, 52.002], [69.002, 52.004], [69.004, 52.004], [69.004, 52.002], [69.002, 52.002]],
      ],
    });
    const check = checkPolygon(holed);
    expect(check.valid).toBe(true);
    expect(check.areaHa).toBeCloseTo(73.07, 1);
  });

  it("rejects a self-intersecting boundary", () => {
    const check = checkPolygon(BOWTIE);
    expect(check.valid).toBe(false);
    expect(check.reasons).toContain("polygon boundary self-intersects");
  });

  it("rejects coordinates outside lon/lat bounds", () => {
    const bad = normalizePolygon({ type: "Polygon", coordinates: [[[200, 52], [201, 52], [201, 53], [200, 52]]] });
    expect(checkPolygon(bad).valid).toBe(false);
  });

  it("rejects areas too large for a single field", () => {
    const huge = normalizePolygon({ type: "Polygon", coordinates: [[[69, 52], [71, 52], [71, 54], [69, 54], [69, 52]]] });
    const check = checkPolygon(huge);
    expect(check.valid).toBe(false);
    expect(check.reasons[0]).toMatch(/exceeds 20000 ha/);
  });
});

describe("areaMismatch", () => {
  it("is the relative difference to the declared area", () => {
    expect(areaMismatch(105, 100)).toBe(0.05);
    expect(areaMismatch(90, 100)).toBeCloseTo(0.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/geometry.test.ts`
Expected: FAIL, cannot resolve `../src/geometry`.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/geometry.ts`:
```ts
import type { PolygonGeometry } from "@f2f/sdk";
import { area } from "@turf/area";
import { kinks } from "@turf/kinks";

/** Guards the CDSE quota: larger areas are almost certainly a wrong file, not a field. */
export const MAX_FIELD_AREA_HA = 20_000;

export interface GeometryCheck {
  valid: boolean;
  areaHa: number;
  reasons: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function checkPolygon(polygon: PolygonGeometry): GeometryCheck {
  const reasons: string[] = [];

  polygon.coordinates.forEach((ring, r) => {
    if (ring.some(([lon, lat]) => lon < -180 || lon > 180 || lat < -90 || lat > 90)) {
      reasons.push(`ring ${r} has a coordinate outside lon/lat bounds`);
    }
  });
  if (reasons.length === 0 && kinks(polygon).features.length > 0) {
    reasons.push("polygon boundary self-intersects");
  }

  const areaHa = reasons.length === 0 ? round2(area(polygon) / 10_000) : 0;
  if (reasons.length === 0 && areaHa <= 0) reasons.push("polygon has zero area");
  if (areaHa > MAX_FIELD_AREA_HA) reasons.push(`polygon area ${areaHa} ha exceeds ${MAX_FIELD_AREA_HA} ha`);

  return { valid: reasons.length === 0, areaHa, reasons };
}

export function areaMismatch(computedHa: number, declaredHa: number): number {
  return Math.abs(computedHa - declaredHa) / declaredHa;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/geometry.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): polygon validity and geodesic area"
```

---

### Task 5: Statistical API request builder, evalscript and response parser

**Files:**
- Create: `apps/scas-worker/src/sentinel/evalscript.ts`, `src/sentinel/request.ts`, `src/sentinel/parse.ts`
- Create fixtures: `apps/scas-worker/test/fixtures/stats-clear.json`, `stats-cloudy.json`, `stats-empty.json`, `stats-partial-error.json`, `stats-harvest.json`
- Test: `apps/scas-worker/test/sentinel-request.test.ts`, `test/sentinel-parse.test.ts`

**Interfaces:**
- Consumes: `PolygonGeometry`; `SentinelError` from Task 3.
- Produces: `EVALSCRIPT: string`, `CRS_WGS84`, `MAX_TILE_CLOUD_COVER = 80`, `interface TimeWindow { from: string; to: string }`, `interface StatsRequest`, `resolutionDegrees(latitude: number): { resx: number; resy: number }`, `windowEndingAt(asOf: Date, days: number): TimeWindow`, `buildStatsRequest(polygon: PolygonGeometry, window: TimeWindow): StatsRequest`; `interface Observation { date: string; ndviMean: number | null; clearRatio: number; clearPixels: number; footprintPixels: number }`, `interface FailedInterval { date: string; error: string }`, `interface ParsedStats { observations: Observation[]; failedIntervals: FailedInterval[]; polygonPixels: number }`, `parseStats(raw: unknown): ParsedStats`.

How the counts work (from the CDSE docs): `sampleCount` is the number of pixels in the bounding box of the geometry; `noDataCount` counts pixels excluded by the `dataMask` output, including pixels outside the polygon. The evalscript therefore emits two outputs with separate masks: `footprint` (mask = input `dataMask`, so it counts polygon pixels that have data that day) and `ndvi` (mask = `dataMask` × clear, so it counts clear polygon pixels). A day with zero footprint pixels had no acquisition. The polygon's pixel count is the largest footprint in the window; `clearRatio = clearPixels / polygonPixels`.

- [ ] **Step 1: Create the fixtures**

These follow the documented response shape (`data[].interval`, `data[].outputs.<id>.bands.B0.stats`). Task 14 adds a real recorded response next to them.

`apps/scas-worker/test/fixtures/stats-clear.json`:
```json
{
  "data": [
    {
      "interval": { "from": "2026-09-10T00:00:00Z", "to": "2026-09-11T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.05, "max": 0.41, "mean": 0.21, "stDev": 0.04, "sampleCount": 1600, "noDataCount": 650 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    },
    {
      "interval": { "from": "2026-09-15T00:00:00Z", "to": "2026-09-16T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.11, "max": 0.44, "mean": 0.3, "stDev": 0.06, "sampleCount": 1600, "noDataCount": 1500 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    },
    {
      "interval": { "from": "2026-09-17T00:00:00Z", "to": "2026-09-18T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": "NaN", "max": "NaN", "mean": "NaN", "stDev": "NaN", "sampleCount": 1600, "noDataCount": 1600 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": "NaN", "max": "NaN", "mean": "NaN", "stDev": "NaN", "sampleCount": 1600, "noDataCount": 1600 } } } }
      }
    },
    {
      "interval": { "from": "2026-09-20T00:00:00Z", "to": "2026-09-21T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.04, "max": 0.38, "mean": 0.19, "stDev": 0.04, "sampleCount": 1600, "noDataCount": 610 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    }
  ],
  "status": "OK"
}
```

`apps/scas-worker/test/fixtures/stats-cloudy.json`:
```json
{
  "data": [
    {
      "interval": { "from": "2026-09-12T00:00:00Z", "to": "2026-09-13T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.08, "max": 0.4, "mean": 0.25, "stDev": 0.05, "sampleCount": 1600, "noDataCount": 1100 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    },
    {
      "interval": { "from": "2026-09-22T00:00:00Z", "to": "2026-09-23T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": "NaN", "max": "NaN", "mean": "NaN", "stDev": "NaN", "sampleCount": 1600, "noDataCount": 1600 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    }
  ],
  "status": "OK"
}
```

`apps/scas-worker/test/fixtures/stats-empty.json`:
```json
{ "data": [], "status": "OK" }
```

`apps/scas-worker/test/fixtures/stats-partial-error.json`:
```json
{
  "data": [
    {
      "interval": { "from": "2026-07-08T00:00:00Z", "to": "2026-07-09T00:00:00Z" },
      "error": { "type": "EXECUTION_ERROR", "message": "Failed to process the interval" }
    },
    {
      "interval": { "from": "2026-07-10T00:00:00Z", "to": "2026-07-11T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.41, "max": 0.88, "mean": 0.72, "stDev": 0.07, "sampleCount": 1600, "noDataCount": 620 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    }
  ],
  "status": "OK"
}
```

`apps/scas-worker/test/fixtures/stats-harvest.json`:
```json
{
  "data": [
    {
      "interval": { "from": "2026-07-15T00:00:00Z", "to": "2026-07-16T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.5, "max": 0.91, "mean": 0.78, "stDev": 0.06, "sampleCount": 1600, "noDataCount": 610 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    },
    {
      "interval": { "from": "2026-08-20T00:00:00Z", "to": "2026-08-21T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.3, "max": 0.7, "mean": 0.55, "stDev": 0.08, "sampleCount": 1600, "noDataCount": 630 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    },
    {
      "interval": { "from": "2026-09-05T00:00:00Z", "to": "2026-09-06T00:00:00Z" },
      "outputs": {
        "ndvi": { "bands": { "B0": { "stats": { "min": 0.08, "max": 0.39, "mean": 0.24, "stDev": 0.05, "sampleCount": 1600, "noDataCount": 640 } } } },
        "footprint": { "bands": { "B0": { "stats": { "min": 1, "max": 1, "mean": 1, "stDev": 0, "sampleCount": 1600, "noDataCount": 600 } } } }
      }
    }
  ],
  "status": "OK"
}
```

- [ ] **Step 2: Write the failing tests**

`apps/scas-worker/test/sentinel-request.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { EVALSCRIPT } from "../src/sentinel/evalscript";
import { CRS_WGS84, buildStatsRequest, resolutionDegrees, windowEndingAt } from "../src/sentinel/request";
import { SQUARE } from "./helpers";

describe("windowEndingAt", () => {
  it("covers whole UTC days and ends after the as-of day", () => {
    expect(windowEndingAt(new Date("2026-10-03T15:00:00Z"), 90)).toEqual({
      from: "2026-07-06T00:00:00Z",
      to: "2026-10-04T00:00:00Z",
    });
  });
});

describe("resolutionDegrees", () => {
  it("is about 10 m at the field's latitude", () => {
    expect(resolutionDegrees(52.005)).toEqual({ resx: 0.00014593, resy: 0.00008983 });
  });
});

describe("buildStatsRequest", () => {
  it("asks for daily Sentinel-2 L2A statistics over the polygon in WGS84", () => {
    const window = { from: "2026-07-06T00:00:00Z", to: "2026-10-04T00:00:00Z" };
    const req = buildStatsRequest(SQUARE, window);
    expect(req.input.bounds.geometry).toEqual(SQUARE);
    expect(req.input.bounds.properties.crs).toBe(CRS_WGS84);
    expect(req.input.data[0]).toEqual({
      type: "sentinel-2-l2a",
      dataFilter: { maxCloudCoverage: 80, mosaickingOrder: "leastCC" },
    });
    expect(req.aggregation.timeRange).toEqual(window);
    expect(req.aggregation.aggregationInterval).toEqual({ of: "P1D" });
    expect(req.aggregation.evalscript).toBe(EVALSCRIPT);
    expect(req.aggregation.resx).toBeCloseTo(0.000146, 6);
  });

  it("masks clouds with SCL and emits separate footprint and ndvi masks", () => {
    expect(EVALSCRIPT).toContain('"SCL"');
    expect(EVALSCRIPT).toContain('bands: ["ndvi", "footprint"]');
    expect(EVALSCRIPT).toContain("[0, 1, 3, 8, 9, 10, 11]");
  });
});
```

`apps/scas-worker/test/sentinel-parse.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { SentinelError } from "../src/errors";
import { parseStats } from "../src/sentinel/parse";
import clear from "./fixtures/stats-clear.json";
import cloudy from "./fixtures/stats-cloudy.json";
import empty from "./fixtures/stats-empty.json";
import partial from "./fixtures/stats-partial-error.json";

describe("parseStats", () => {
  it("turns daily intervals into observations and skips days without acquisition", () => {
    const parsed = parseStats(clear);
    expect(parsed.polygonPixels).toBe(1000);
    expect(parsed.observations).toEqual([
      { date: "2026-09-10", ndviMean: 0.21, clearPixels: 950, footprintPixels: 1000, clearRatio: 0.95 },
      { date: "2026-09-15", ndviMean: 0.3, clearPixels: 100, footprintPixels: 1000, clearRatio: 0.1 },
      { date: "2026-09-20", ndviMean: 0.19, clearPixels: 990, footprintPixels: 1000, clearRatio: 0.99 },
    ]);
    expect(parsed.failedIntervals).toEqual([]);
  });

  it("reports NaN means as null", () => {
    const parsed = parseStats(cloudy);
    expect(parsed.observations.map((o) => [o.clearRatio, o.ndviMean])).toEqual([
      [0.5, 0.25],
      [0, null],
    ]);
  });

  it("returns no observations for an empty response", () => {
    expect(parseStats(empty)).toEqual({ observations: [], failedIntervals: [], polygonPixels: 0 });
  });

  it("records failed intervals and keeps the rest", () => {
    const parsed = parseStats(partial);
    expect(parsed.failedIntervals).toEqual([{ date: "2026-07-08", error: "Failed to process the interval" }]);
    expect(parsed.observations).toHaveLength(1);
  });

  it("throws when every interval failed", () => {
    const allFailed = { data: [partial.data[0]] };
    expect(() => parseStats(allFailed)).toThrow(SentinelError);
  });

  it("throws on a response that does not have the documented shape", () => {
    expect(() => parseStats({ error: { status: 400 } })).toThrow(/unexpected Statistical API response/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -C apps/scas-worker exec vitest run test/sentinel-request.test.ts test/sentinel-parse.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement**

`apps/scas-worker/src/sentinel/evalscript.ts`:
```ts
/**
 * Per-pixel NDVI with Sentinel-2 L2A scene classification (SCL) cloud masking.
 * Two outputs with separate data masks:
 * - footprint: 1 for every polygon pixel that has data that day,
 * - ndvi: NDVI for clear polygon pixels only.
 * SCL classes treated as not clear: 0 no data, 1 saturated or defective,
 * 3 cloud shadow, 8 cloud medium probability, 9 cloud high probability,
 * 10 thin cirrus, 11 snow or ice.
 */
export const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "footprint", bands: 1, sampleType: "UINT8" },
      { id: "dataMask", bands: ["ndvi", "footprint"] }
    ]
  };
}
var NOT_CLEAR = [0, 1, 3, 8, 9, 10, 11];
function evaluatePixel(s) {
  var sum = s.B08 + s.B04;
  var clear = NOT_CLEAR.indexOf(s.SCL) === -1 && sum !== 0 ? 1 : 0;
  var ndvi = sum === 0 ? 0 : (s.B08 - s.B04) / sum;
  return { ndvi: [ndvi], footprint: [1], dataMask: [s.dataMask * clear, s.dataMask] };
}
`;
```

`apps/scas-worker/src/sentinel/request.ts`:
```ts
import type { PolygonGeometry } from "@f2f/sdk";
import { EVALSCRIPT } from "./evalscript";

export const CRS_WGS84 = "http://www.opengis.net/def/crs/EPSG/0/4326";
/** Tile-level prefilter only, to save processing units. The 30% rule is applied per polygon. */
export const MAX_TILE_CLOUD_COVER = 80;
const METERS_PER_DEGREE = 111_320;
const DAY_MS = 86_400_000;

export interface TimeWindow {
  from: string;
  to: string;
}

export interface StatsRequest {
  input: {
    bounds: { geometry: PolygonGeometry; properties: { crs: string } };
    data: { type: "sentinel-2-l2a"; dataFilter: { maxCloudCoverage: number; mosaickingOrder: "leastCC" } }[];
  };
  aggregation: {
    timeRange: TimeWindow;
    aggregationInterval: { of: "P1D" };
    evalscript: string;
    resx: number;
    resy: number;
  };
}

const round8 = (n: number) => Math.round(n * 1e8) / 1e8;
const isoSeconds = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");

/** In EPSG:4326 resx/resy are degrees; this gives about 10 m pixels at the given latitude. */
export function resolutionDegrees(latitude: number): { resx: number; resy: number } {
  return {
    resx: round8(10 / (METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180))),
    resy: round8(10 / METERS_PER_DEGREE),
  };
}

function centroidLatitude(polygon: PolygonGeometry): number {
  const outer = polygon.coordinates[0] ?? [];
  const points = outer.slice(0, -1);
  return points.reduce((sum, p) => sum + p[1], 0) / Math.max(points.length, 1);
}

/** `days` whole UTC days ending with the as-of day; `to` is exclusive, so P1D divides it exactly. */
export function windowEndingAt(asOf: Date, days: number): TimeWindow {
  const end = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + 1);
  return { from: isoSeconds(end - days * DAY_MS), to: isoSeconds(end) };
}

export function buildStatsRequest(polygon: PolygonGeometry, window: TimeWindow): StatsRequest {
  const { resx, resy } = resolutionDegrees(centroidLatitude(polygon));
  return {
    input: {
      bounds: { geometry: polygon, properties: { crs: CRS_WGS84 } },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: { maxCloudCoverage: MAX_TILE_CLOUD_COVER, mosaickingOrder: "leastCC" },
        },
      ],
    },
    aggregation: {
      timeRange: window,
      aggregationInterval: { of: "P1D" },
      evalscript: EVALSCRIPT,
      resx,
      resy,
    },
  };
}
```

`apps/scas-worker/src/sentinel/parse.ts`:
```ts
import { z } from "zod";
import { SentinelError } from "../errors";

const StatsSchema = z.object({
  mean: z.union([z.number(), z.string()]).optional(),
  sampleCount: z.number(),
  noDataCount: z.number(),
});
const OutputSchema = z.object({ bands: z.object({ B0: z.object({ stats: StatsSchema }) }) });
const IntervalSchema = z.object({
  interval: z.object({ from: z.string(), to: z.string() }),
  outputs: z.object({ ndvi: OutputSchema, footprint: OutputSchema }).optional(),
  error: z.object({ type: z.string().optional(), message: z.string().optional() }).optional(),
});
const ResponseSchema = z.object({ data: z.array(IntervalSchema) });

export interface Observation {
  /** Acquisition day, YYYY-MM-DD (UTC). */
  date: string;
  /** Mean NDVI over clear polygon pixels; null when no pixel was clear. */
  ndviMean: number | null;
  /** Clear pixels divided by the polygon's pixel count; a scene is clear at 0.7 or more. */
  clearRatio: number;
  clearPixels: number;
  footprintPixels: number;
}

export interface FailedInterval {
  date: string;
  error: string;
}

export interface ParsedStats {
  observations: Observation[];
  failedIntervals: FailedInterval[];
  polygonPixels: number;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function parseStats(raw: unknown): ParsedStats {
  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SentinelError(`unexpected Statistical API response: ${parsed.error.issues[0]?.message ?? "invalid"}`, {
      retryable: false,
    });
  }

  const failedIntervals: FailedInterval[] = [];
  const days: { date: string; footprint: number; clear: number; mean: number | null }[] = [];

  for (const item of parsed.data.data) {
    const date = item.interval.from.slice(0, 10);
    if (item.error || !item.outputs) {
      failedIntervals.push({ date, error: item.error?.message ?? item.error?.type ?? "missing outputs" });
      continue;
    }
    const fp = item.outputs.footprint.bands.B0.stats;
    const nd = item.outputs.ndvi.bands.B0.stats;
    const footprint = fp.sampleCount - fp.noDataCount;
    if (footprint <= 0) continue; // no acquisition over the polygon that day
    const clear = nd.sampleCount - nd.noDataCount;
    const mean = nd.mean === undefined ? Number.NaN : Number(nd.mean);
    days.push({ date, footprint, clear, mean: clear > 0 && Number.isFinite(mean) ? mean : null });
  }

  if (parsed.data.data.length > 0 && failedIntervals.length === parsed.data.data.length) {
    throw new SentinelError(`all ${failedIntervals.length} intervals failed: ${failedIntervals[0]?.error}`, {
      retryable: false,
    });
  }

  const polygonPixels = days.reduce((max, d) => Math.max(max, d.footprint), 0);
  const observations = days.map((d) => ({
    date: d.date,
    ndviMean: d.mean,
    clearPixels: d.clear,
    footprintPixels: d.footprint,
    clearRatio: polygonPixels > 0 ? round4(d.clear / polygonPixels) : 0,
  }));
  return { observations, failedIntervals, polygonPixels };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/sentinel-request.test.ts test/sentinel-parse.test.ts`
Expected: 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): Statistical API request, evalscript and parser"
```

---

### Task 6: Sentinel client with token cache and retries

**Files:**
- Create: `apps/scas-worker/src/sentinel/client.ts`
- Test: `apps/scas-worker/test/sentinel-client.test.ts`

**Interfaces:**
- Consumes: `StatsRequest` (Task 5), `SentinelError` (Task 3).
- Produces: `CDSE_TOKEN_URL`, `CDSE_STATS_URL`, `interface StatsSource { fetchStats(request: StatsRequest): Promise<unknown> }`, `interface SentinelClientOptions { clientId: string; clientSecret: string; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; maxAttempts?: number; baseDelayMs?: number }`, `class SentinelClient implements StatsSource`.

Retry policy: up to 4 attempts; 429, 5xx, network errors and 401 (after dropping the cached token) are retried with 500 ms × 2ⁿ backoff, or `Retry-After` seconds when given (capped at 30 s). Other 4xx fail at once. Tokens are cached until 60 s before `expires_in` (CDSE tokens last 10 minutes; CDSE rate-limits token requests).

- [ ] **Step 1: Write the failing test**

`apps/scas-worker/test/sentinel-client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { SentinelError } from "../src/errors";
import { CDSE_STATS_URL, CDSE_TOKEN_URL, SentinelClient } from "../src/sentinel/client";
import { buildStatsRequest } from "../src/sentinel/request";
import { SQUARE } from "./helpers";

const REQUEST = buildStatsRequest(SQUARE, { from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z" });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function fakeFetch(statsResponses: (() => Response)[]) {
  const calls = { token: 0, stats: 0, bodies: [] as string[] };
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === CDSE_TOKEN_URL) {
      calls.token += 1;
      calls.bodies.push(String(init?.body));
      return json({ access_token: `token-${calls.token}`, expires_in: 600 });
    }
    expect(url).toBe(CDSE_STATS_URL);
    const next = statsResponses[Math.min(calls.stats, statsResponses.length - 1)];
    calls.stats += 1;
    if (!next) throw new Error("no stats response configured");
    return next();
  };
  return { fetch: fn as typeof fetch, calls };
}

const ok = () => json({ data: [], status: "OK" });

describe("SentinelClient", () => {
  it("requests a client-credentials token once and reuses it", async () => {
    const { fetch, calls } = fakeFetch([ok]);
    const client = new SentinelClient({ clientId: "id", clientSecret: "s3cret", fetch, sleep: vi.fn() });
    await client.fetchStats(REQUEST);
    await client.fetchStats(REQUEST);
    expect(calls.token).toBe(1);
    expect(calls.stats).toBe(2);
    expect(calls.bodies[0]).toBe("grant_type=client_credentials&client_id=id&client_secret=s3cret");
  });

  it("refreshes the token after it expires", async () => {
    const { fetch, calls } = fakeFetch([ok]);
    let now = 0;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, now: () => now, sleep: vi.fn() });
    await client.fetchStats(REQUEST);
    now = 541_000; // past 600 s minus the 60 s margin
    await client.fetchStats(REQUEST);
    expect(calls.token).toBe(2);
  });

  it("retries a 500 with backoff and then succeeds", async () => {
    const { fetch, calls } = fakeFetch([() => json({ error: "boom" }, 500), ok]);
    const sleep = vi.fn(async () => {});
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep });
    await expect(client.fetchStats(REQUEST)).resolves.toEqual({ data: [], status: "OK" });
    expect(calls.stats).toBe(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("honors Retry-After on 429", async () => {
    const { fetch } = fakeFetch([() => json({}, 429, { "retry-after": "2" }), ok]);
    const sleep = vi.fn(async () => {});
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep });
    await client.fetchStats(REQUEST);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after 4 attempts with a SentinelError", async () => {
    const { fetch, calls } = fakeFetch([() => json({ error: "down" }, 503)]);
    const sleep = vi.fn(async () => {});
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep });
    await expect(client.fetchStats(REQUEST)).rejects.toBeInstanceOf(SentinelError);
    expect(calls.stats).toBe(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 2000]);
  });

  it("does not retry a 400", async () => {
    const { fetch, calls } = fakeFetch([() => json({ error: { message: "bad evalscript" } }, 400)]);
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn() });
    await expect(client.fetchStats(REQUEST)).rejects.toThrow(/returned 400/);
    expect(calls.stats).toBe(1);
  });

  it("drops the token and retries on 401", async () => {
    const { fetch, calls } = fakeFetch([() => json({}, 401), ok]);
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    await client.fetchStats(REQUEST);
    expect(calls.token).toBe(2);
  });

  it("treats network errors as retryable", async () => {
    let first = true;
    const { fetch: inner } = fakeFetch([ok]);
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === CDSE_STATS_URL && first) {
        first = false;
        throw new TypeError("fetch failed");
      }
      return inner(input, init);
    }) as typeof globalThis.fetch;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    await expect(client.fetchStats(REQUEST)).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/sentinel-client.test.ts`
Expected: FAIL, cannot resolve `../src/sentinel/client`.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/sentinel/client.ts`:
```ts
import { SentinelError } from "../errors";
import type { StatsRequest } from "./request";

export const CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
export const CDSE_STATS_URL = "https://sh.dataspace.copernicus.eu/statistics/v1";

const TOKEN_MARGIN_S = 60;
const MAX_RETRY_AFTER_MS = 30_000;

export interface StatsSource {
  fetchStats(request: StatsRequest): Promise<unknown>;
}

export interface SentinelClientOptions {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export class SentinelClient implements StatsSource {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(private readonly opts: SentinelClientOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = opts.now ?? Date.now;
    this.maxAttempts = opts.maxAttempts ?? 4;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
  }

  async fetchStats(request: StatsRequest): Promise<unknown> {
    return this.withRetry(async () => {
      const token = await this.getToken();
      const res = await this.call(CDSE_STATS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(request),
      });
      if (res.status === 401) {
        this.token = null;
        throw new SentinelError("Statistical API rejected the access token", { retryable: true, status: 401 });
      }
      await this.throwIfFailed(res, "Statistical API");
      return (await res.json()) as unknown;
    });
  }

  private async getToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) return this.token.value;
    const res = await this.call(CDSE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
      }).toString(),
    });
    await this.throwIfFailed(res, "CDSE token endpoint");
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string") {
      throw new SentinelError("CDSE token response has no access_token", { retryable: false });
    }
    const ttlSeconds = typeof body.expires_in === "number" ? body.expires_in : 300;
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + Math.max(ttlSeconds - TOKEN_MARGIN_S, 10) * 1000,
    };
    return this.token.value;
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, init);
    } catch (cause) {
      throw new SentinelError(`network error calling ${new URL(url).host}`, { retryable: true, cause });
    }
  }

  private async throwIfFailed(res: Response, what: string): Promise<void> {
    if (res.ok) return;
    const text = (await res.text().catch(() => "")).slice(0, 300);
    const retryAfterS = Number(res.headers.get("retry-after"));
    throw new SentinelError(`${what} returned ${res.status}: ${text}`, {
      retryable: res.status === 429 || res.status >= 500,
      status: res.status,
      retryAfterMs:
        Number.isFinite(retryAfterS) && retryAfterS > 0 ? Math.min(retryAfterS * 1000, MAX_RETRY_AFTER_MS) : undefined,
    });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof SentinelError) || !err.retryable || attempt >= this.maxAttempts) {
          throw err instanceof SentinelError ? err : new SentinelError(String(err), { retryable: false, cause: err });
        }
        await this.sleep(err.retryAfterMs ?? this.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/sentinel-client.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): CDSE client with token cache and retries"
```

---

### Task 7: Verdict rules and the crop calendar

**Files:**
- Create: `apps/scas-worker/src/rules/crops.ts`, `apps/scas-worker/src/rules/verdict.ts`
- Test: `apps/scas-worker/test/verdict.test.ts`

**Interfaces:**
- Consumes: `Observation` (Task 5), `GeometryCheck`, `areaMismatch` (Task 4), `RequestError` (Task 3), `AttestationKindName`, `VerdictName` from `@f2f/sdk`.
- Produces: `interface CropCalendar`, `CROP_CALENDARS`, `calendarFor(crop: string): CropCalendar | undefined`; `RULES_VERSION = "f2f-scas-rules/1"`, `CLEAR_RATIO_MIN = 0.7`, `AREA_TOLERANCE = 0.05`, `WINDOW_DAYS: Record<AttestationKindName, number>`, `interface DecideInput { kind; crop: string; asOf: Date; geometry: GeometryCheck; declaredAreaHa: number; observations: Observation[] }`, `interface Decision { verdict: VerdictName; ndviMean: number | null; sceneDate: string | null; reasons: string[] }`, `assertRuleApplicable(kind, crop, asOf): void` (throws `RequestError` 422), `decide(input: DecideInput): Decision`.

Rules (version `f2f-scas-rules/1`). A clear observation has `clearRatio >= 0.7` and a non-null NDVI. The reported NDVI and scene date are those of the latest clear observation.

| Kind | Window | Pass | Fail | InsufficientData |
| --- | --- | --- | --- | --- |
| FieldVerified | 90 days | valid polygon, area within 5%, ≥1 clear scene | invalid polygon or area off by more than 5% | no clear scene |
| Sowing | 30 days | latest clear NDVI inside the crop's sowing band | outside the band | no clear scene |
| Vegetation | 20 days | latest clear NDVI inside the crop's range for the as-of month | outside the range | no clear scene |
| Harvest | 120 days | peak ≥ peak minimum, latest ≤ post-harvest maximum, latest after peak | otherwise | fewer than 2 clear scenes |

Sowing, Vegetation and Harvest outside the crop's months, or for a crop without a calendar, are refused with 422 before any API call.

- [ ] **Step 1: Write the failing test**

`apps/scas-worker/test/verdict.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { RequestError } from "../src/errors";
import type { GeometryCheck } from "../src/geometry";
import { assertRuleApplicable, decide, type DecideInput } from "../src/rules/verdict";
import type { Observation } from "../src/sentinel/parse";

const VALID: GeometryCheck = { valid: true, areaHa: 100, reasons: [] };
const obs = (date: string, ndviMean: number | null, clearRatio = 0.95): Observation => ({
  date,
  ndviMean,
  clearRatio,
  clearPixels: Math.round(clearRatio * 1000),
  footprintPixels: 1000,
});
const input = (over: Partial<DecideInput>): DecideInput => ({
  kind: "FieldVerified",
  crop: "wheat",
  asOf: new Date("2026-10-03T09:00:00Z"),
  geometry: VALID,
  declaredAreaHa: 100,
  observations: [],
  ...over,
});

describe("FieldVerified", () => {
  it("passes with a valid polygon, matching area and a clear scene", () => {
    const d = decide(input({ declaredAreaHa: 104, observations: [obs("2026-09-10", 0.21), obs("2026-09-20", 0.19)] }));
    expect(d).toMatchObject({ verdict: "Pass", ndviMean: 0.19, sceneDate: "2026-09-20" });
  });

  it("passes at exactly 5% area difference and counts exactly 70% clear as clear", () => {
    const d = decide(input({ geometry: { ...VALID, areaHa: 105 }, observations: [obs("2026-09-10", 0.2, 0.7)] }));
    expect(d.verdict).toBe("Pass");
  });

  it("fails on an area mismatch above 5% even with clear scenes", () => {
    const d = decide(input({ declaredAreaHa: 90, observations: [obs("2026-09-20", 0.19)] }));
    expect(d.verdict).toBe("Fail");
    expect(d.reasons[0]).toMatch(/differs from declared 90 ha by 11\.1%/);
  });

  it("fails on an invalid polygon", () => {
    const d = decide(input({ geometry: { valid: false, areaHa: 0, reasons: ["polygon boundary self-intersects"] } }));
    expect(d).toMatchObject({ verdict: "Fail", reasons: ["polygon boundary self-intersects"] });
  });

  it("gives InsufficientData when only cloudy scenes exist", () => {
    const d = decide(input({ observations: [obs("2026-09-12", 0.25, 0.5), obs("2026-09-22", null, 0)] }));
    expect(d).toMatchObject({ verdict: "InsufficientData", ndviMean: null, sceneDate: null });
  });

  it("gives InsufficientData when there are no scenes", () => {
    expect(decide(input({})).verdict).toBe("InsufficientData");
  });
});

describe("season kinds (wheat, northern Kazakhstan)", () => {
  it("Vegetation passes inside the July range and fails below it", () => {
    const asOf = new Date("2026-07-12T12:00:00Z");
    expect(decide(input({ kind: "Vegetation", asOf, observations: [obs("2026-07-10", 0.72)] })).verdict).toBe("Pass");
    expect(decide(input({ kind: "Vegetation", asOf, observations: [obs("2026-07-10", 0.3)] })).verdict).toBe("Fail");
  });

  it("Sowing passes for bare or emerging soil and fails for dense vegetation", () => {
    const asOf = new Date("2026-05-30T12:00:00Z");
    expect(decide(input({ kind: "Sowing", asOf, observations: [obs("2026-05-25", 0.18)] })).verdict).toBe("Pass");
    expect(decide(input({ kind: "Sowing", asOf, observations: [obs("2026-05-25", 0.7)] })).verdict).toBe("Fail");
  });

  it("Harvest passes when NDVI drops after the season peak", () => {
    const asOf = new Date("2026-09-10T12:00:00Z");
    const series = [obs("2026-07-15", 0.78), obs("2026-08-20", 0.55), obs("2026-09-05", 0.24)];
    expect(decide(input({ kind: "Harvest", asOf, observations: series }))).toMatchObject({
      verdict: "Pass",
      ndviMean: 0.24,
      sceneDate: "2026-09-05",
    });
  });

  it("Harvest fails without a drop and needs two clear scenes", () => {
    const asOf = new Date("2026-09-10T12:00:00Z");
    const noDrop = [obs("2026-07-15", 0.78), obs("2026-09-05", 0.7)];
    expect(decide(input({ kind: "Harvest", asOf, observations: noDrop })).verdict).toBe("Fail");
    expect(decide(input({ kind: "Harvest", asOf, observations: [obs("2026-09-05", 0.24)] })).verdict).toBe(
      "InsufficientData",
    );
  });
});

describe("assertRuleApplicable", () => {
  it("allows FieldVerified for any crop", () => {
    expect(() => assertRuleApplicable("FieldVerified", "cotton", new Date("2026-10-03"))).not.toThrow();
  });

  it("refuses season kinds outside the crop calendar or for unknown crops", () => {
    expect(() => assertRuleApplicable("Vegetation", "wheat", new Date("2026-10-03"))).toThrow(RequestError);
    expect(() => assertRuleApplicable("Sowing", "cotton", new Date("2026-05-20"))).toThrow(/no crop calendar/);
    expect(() => assertRuleApplicable("Vegetation", "Wheat", new Date("2026-07-12"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/verdict.test.ts`
Expected: FAIL, cannot resolve `../src/rules/verdict`.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/rules/crops.ts`:
```ts
export interface CropCalendar {
  /** Months (1-12) in which a Sowing Attestation makes sense. */
  sowingMonths: number[];
  /** NDVI band of bare or emerging soil after sowing. */
  sowingNdvi: [number, number];
  /** Expected NDVI range per month (1-12) during vegetation. */
  vegetation: Record<number, [number, number]>;
  harvestMonths: number[];
  /** The season peak must reach at least this NDVI. */
  harvestPeakMin: number;
  /** After harvest the latest NDVI must be at most this. */
  harvestLatestMax: number;
  source: string;
}

/**
 * DEMO ASSUMPTION. Spring wheat in northern Kazakhstan (Akmola, Kostanay, North
 * Kazakhstan regions): sowing mid-May to early June, peak canopy in July,
 * ripening in August, harvest late August to September. Ranges are generous
 * hand-set bands for a demo, not calibrated against ground truth.
 */
export const CROP_CALENDARS: Record<string, CropCalendar> = {
  wheat: {
    sowingMonths: [5, 6],
    sowingNdvi: [0.05, 0.4],
    vegetation: { 6: [0.2, 0.65], 7: [0.45, 0.9], 8: [0.3, 0.8] },
    harvestMonths: [8, 9],
    harvestPeakMin: 0.5,
    harvestLatestMax: 0.35,
    source: "demo assumption: spring wheat, northern Kazakhstan; not calibrated",
  },
};

export function calendarFor(crop: string): CropCalendar | undefined {
  return CROP_CALENDARS[crop.trim().toLowerCase()];
}
```

`apps/scas-worker/src/rules/verdict.ts`:
```ts
import type { AttestationKindName, VerdictName } from "@f2f/sdk";
import { RequestError } from "../errors";
import { areaMismatch, type GeometryCheck } from "../geometry";
import type { Observation } from "../sentinel/parse";
import { calendarFor, type CropCalendar } from "./crops";

export const RULES_VERSION = "f2f-scas-rules/1";
/** Spec: scenes with more than 30% cloud over the polygon are skipped. */
export const CLEAR_RATIO_MIN = 0.7;
export const AREA_TOLERANCE = 0.05;
export const WINDOW_DAYS: Record<AttestationKindName, number> = {
  FieldVerified: 90,
  Sowing: 30,
  Vegetation: 20,
  Harvest: 120,
};

export interface DecideInput {
  kind: AttestationKindName;
  crop: string;
  asOf: Date;
  geometry: GeometryCheck;
  declaredAreaHa: number;
  observations: Observation[];
}

export interface Decision {
  verdict: VerdictName;
  ndviMean: number | null;
  sceneDate: string | null;
  reasons: string[];
}

type ClearObservation = Observation & { ndviMean: number };

const isClear = (o: Observation): o is ClearObservation => o.ndviMean !== null && o.clearRatio >= CLEAR_RATIO_MIN;
const fmt = (n: number) => n.toFixed(3);
const month = (d: Date) => d.getUTCMonth() + 1;

function requireCalendar(crop: string): CropCalendar {
  const cal = calendarFor(crop);
  if (!cal) throw new RequestError(`no crop calendar for "${crop}"; season Attestations need one`, 422);
  return cal;
}

/** Throws before any API call when a season rule cannot apply to this crop and date. */
export function assertRuleApplicable(kind: AttestationKindName, crop: string, asOf: Date): void {
  if (kind === "FieldVerified") return;
  const cal = requireCalendar(crop);
  const m = month(asOf);
  const months =
    kind === "Sowing" ? cal.sowingMonths : kind === "Harvest" ? cal.harvestMonths : Object.keys(cal.vegetation).map(Number);
  if (!months.includes(m)) {
    throw new RequestError(`${kind} is not defined for ${crop} in month ${m}; allowed months: ${months.join(", ")}`, 422);
  }
}

export function decide(input: DecideInput): Decision {
  const clear = input.observations.filter(isClear).sort((a, b) => a.date.localeCompare(b.date));
  const latest = clear.at(-1);
  const base = { ndviMean: latest?.ndviMean ?? null, sceneDate: latest?.date ?? null };
  const insufficient = (reason: string): Decision => ({ verdict: "InsufficientData", ...base, reasons: [reason] });
  const noClear = `no observation with at least ${CLEAR_RATIO_MIN * 100}% clear pixels in the window`;

  if (!input.geometry.valid) return { verdict: "Fail", ...base, reasons: input.geometry.reasons };

  switch (input.kind) {
    case "FieldVerified": {
      const diff = areaMismatch(input.geometry.areaHa, input.declaredAreaHa);
      if (diff > AREA_TOLERANCE) {
        return {
          verdict: "Fail",
          ...base,
          reasons: [
            `computed area ${input.geometry.areaHa} ha differs from declared ${input.declaredAreaHa} ha by ${(diff * 100).toFixed(1)}% (limit ${AREA_TOLERANCE * 100}%)`,
          ],
        };
      }
      if (!latest) return insufficient(noClear);
      return {
        verdict: "Pass",
        ...base,
        reasons: [`area within ${(diff * 100).toFixed(1)}% of declared`, `latest clear scene ${latest.date}`],
      };
    }
    case "Sowing": {
      const [lo, hi] = requireCalendar(input.crop).sowingNdvi;
      if (!latest) return insufficient(noClear);
      const inBand = latest.ndviMean >= lo && latest.ndviMean <= hi;
      return {
        verdict: inBand ? "Pass" : "Fail",
        ...base,
        reasons: [`NDVI ${fmt(latest.ndviMean)} on ${latest.date} ${inBand ? "inside" : "outside"} sowing band [${lo}, ${hi}]`],
      };
    }
    case "Vegetation": {
      const range = requireCalendar(input.crop).vegetation[month(input.asOf)];
      if (!range) throw new RequestError(`no vegetation range for month ${month(input.asOf)}`, 422);
      if (!latest) return insufficient(noClear);
      const [lo, hi] = range;
      const inRange = latest.ndviMean >= lo && latest.ndviMean <= hi;
      return {
        verdict: inRange ? "Pass" : "Fail",
        ...base,
        reasons: [`NDVI ${fmt(latest.ndviMean)} on ${latest.date} ${inRange ? "inside" : "outside"} expected range [${lo}, ${hi}]`],
      };
    }
    case "Harvest": {
      const cal = requireCalendar(input.crop);
      if (!latest || clear.length < 2) return insufficient("need at least two clear scenes to see the drop after the peak");
      const peak = clear.reduce((best, o) => (o.ndviMean > best.ndviMean ? o : best));
      const dropped =
        peak.ndviMean >= cal.harvestPeakMin && latest.ndviMean <= cal.harvestLatestMax && latest.date > peak.date;
      return {
        verdict: dropped ? "Pass" : "Fail",
        ...base,
        reasons: [
          `peak NDVI ${fmt(peak.ndviMean)} on ${peak.date} (min ${cal.harvestPeakMin})`,
          `latest NDVI ${fmt(latest.ndviMean)} on ${latest.date} (max ${cal.harvestLatestMax})`,
        ],
      };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/verdict.test.ts`
Expected: 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): verdict rules and wheat crop calendar (demo assumption)"
```

---

### Task 8: Evidence document and bucket storage

**Files:**
- Create: `apps/scas-worker/src/evidence.ts`, `apps/scas-worker/src/store.ts`
- Test: `apps/scas-worker/test/evidence.test.ts`, `test/store.test.ts`

**Interfaces:**
- Consumes: `canonicalJson`, `sha256`, `toHex`, `MAX_EVIDENCE_URI_LEN`, `NDVI_SCALE`, `PolygonGeometry`, `AttestationKindName`, `VerdictName` from `@f2f/sdk`; `GeometryCheck`; `StatsRequest`, `TimeWindow`, `Observation`, `FailedInterval`.
- Produces: `EVIDENCE_SCHEMA = "f2f-scas-evidence/1"`, `interface EvidenceDoc` (below), `interface EncodedEvidence { bytes: Uint8Array; hash: Uint8Array; hashHex: string }`, `encodeEvidence(doc): EncodedEvidence`, `evidenceKey(hashHex): string`, `polygonKey(hashHex): string`, `evidenceUri(baseUrl, hashHex): string`, `ndviToX10k(mean: number | null): number`, `sceneDateToUnix(date: string | null): number`; `interface BlobStore { put(key, body: Uint8Array, contentType): Promise<void>; get(key): Promise<Uint8Array | null> }`, `class MemoryStore` (public `objects` map), `interface S3StoreOptions`, `class S3Store`.

- [ ] **Step 1: Write the failing tests**

`apps/scas-worker/test/evidence.test.ts`:
```ts
import { canonicalJson, sha256, toHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import {
  encodeEvidence,
  evidenceKey,
  evidenceUri,
  ndviToX10k,
  polygonKey,
  sceneDateToUnix,
  type EvidenceDoc,
} from "../src/evidence";
import { SQUARE } from "./helpers";

const DOC: EvidenceDoc = {
  schema: "f2f-scas-evidence/1",
  rulesVersion: "f2f-scas-rules/1",
  replay: false,
  generatedAt: "2026-10-03T09:00:00.000Z",
  network: { cluster: "devnet", programId: "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm" },
  subject: {
    project: "Proj1111111111111111111111111111111111111111",
    field: "Fld11111111111111111111111111111111111111111",
    fieldIndex: 0,
    crop: "wheat",
    season: 2027,
    declaredAreaHa: 76.11,
    polygonHash: "ab".repeat(32),
  },
  kind: "FieldVerified",
  asOf: "2026-10-03",
  window: { from: "2026-07-06T00:00:00Z", to: "2026-10-04T00:00:00Z" },
  polygon: SQUARE,
  geometry: { valid: true, areaHa: 76.11, reasons: [] },
  request: null,
  response: null,
  scenes: [],
  failedIntervals: [],
  decision: { verdict: "InsufficientData", ndviMean: null, sceneDate: null, reasons: ["no clear scene"] },
  onChain: { ndviMeanX10k: 0, sceneDate: 0 },
  signer: "Scas111111111111111111111111111111111111111",
};

describe("encodeEvidence", () => {
  it("hashes the canonical JSON bytes", () => {
    const enc = encodeEvidence(DOC);
    expect(new TextDecoder().decode(enc.bytes)).toBe(canonicalJson(DOC));
    expect(enc.hashHex).toBe(toHex(sha256(canonicalJson(DOC))));
    expect(enc.hash).toHaveLength(32);
  });

  it("is independent of key order", () => {
    const reordered = Object.fromEntries(Object.entries(DOC).reverse()) as unknown as EvidenceDoc;
    expect(encodeEvidence(reordered).hashHex).toBe(encodeEvidence(DOC).hashHex);
  });
});

describe("evidence addressing", () => {
  it("keys objects by hash", () => {
    expect(evidenceKey("ab".repeat(32))).toBe(`evidence/${"ab".repeat(32)}.json`);
    expect(polygonKey("cd".repeat(32))).toBe(`polygons/${"cd".repeat(32)}.json`);
  });

  it("builds a URI that fits the program's 128-byte limit", () => {
    const uri = evidenceUri("https://scas.example.app/", "ab".repeat(32));
    expect(uri).toBe(`https://scas.example.app/e/${"ab".repeat(32)}`);
    expect(() => evidenceUri(`https://${"a".repeat(60)}.app`, "ab".repeat(32))).toThrow(/128/);
  });
});

describe("on-chain scaling", () => {
  it("scales NDVI to x10 000 and clamps", () => {
    expect(ndviToX10k(0.19)).toBe(1900);
    expect(ndviToX10k(-0.12346)).toBe(-1235);
    expect(ndviToX10k(1.2)).toBe(10_000);
    expect(ndviToX10k(null)).toBe(0);
  });

  it("converts scene days to unix seconds at UTC midnight", () => {
    expect(sceneDateToUnix("2026-09-20")).toBe(1789862400);
    expect(sceneDateToUnix(null)).toBe(0);
  });
});
```

`apps/scas-worker/test/store.test.ts`:
```ts
import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { MemoryStore, S3Store } from "../src/store";

const OPTS = {
  bucket: "f2f-evidence-abc",
  endpoint: "https://t3.storageapi.dev",
  region: "auto",
  accessKeyId: "ak",
  secretAccessKey: "sk",
  forcePathStyle: false,
};

function fakeS3(reply: (cmd: unknown) => unknown) {
  const sent: unknown[] = [];
  const client = {
    send: async (cmd: unknown) => {
      sent.push(cmd);
      return reply(cmd);
    },
  } as unknown as Pick<S3Client, "send">;
  return { client, sent };
}

describe("MemoryStore", () => {
  it("round-trips objects", async () => {
    const store = new MemoryStore();
    await store.put("a", new Uint8Array([1, 2]), "application/json");
    expect(await store.get("a")).toEqual(new Uint8Array([1, 2]));
    expect(await store.get("missing")).toBeNull();
  });
});

describe("S3Store", () => {
  it("puts objects with bucket, key and content type", async () => {
    const { client, sent } = fakeS3(() => ({}));
    await new S3Store(OPTS, client).put("evidence/x.json", new Uint8Array([1]), "application/json");
    const cmd = sent[0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: OPTS.bucket, Key: "evidence/x.json", ContentType: "application/json" });
  });

  it("returns bytes for an existing object and null for NoSuchKey", async () => {
    const found = fakeS3(() => ({ Body: { transformToByteArray: async () => new Uint8Array([7]) } }));
    expect(await new S3Store(OPTS, found.client).get("k")).toEqual(new Uint8Array([7]));
    expect(found.sent[0]).toBeInstanceOf(GetObjectCommand);

    const missing = fakeS3(() => {
      throw Object.assign(new Error("not found"), { name: "NoSuchKey" });
    });
    expect(await new S3Store(OPTS, missing.client).get("k")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C apps/scas-worker exec vitest run test/evidence.test.ts test/store.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/evidence.ts`:
```ts
import {
  MAX_EVIDENCE_URI_LEN,
  NDVI_SCALE,
  canonicalJson,
  sha256,
  toHex,
  type AttestationKindName,
  type PolygonGeometry,
  type VerdictName,
} from "@f2f/sdk";
import type { GeometryCheck } from "./geometry";
import type { FailedInterval, Observation } from "./sentinel/parse";
import type { StatsRequest, TimeWindow } from "./sentinel/request";

export const EVIDENCE_SCHEMA = "f2f-scas-evidence/1";

/** The document behind an Attestation. Its sha256 is the on-chain evidence_hash. */
export interface EvidenceDoc {
  schema: typeof EVIDENCE_SCHEMA;
  rulesVersion: string;
  /** True when the as-of date is a replay of a past season (spec 4.4, season timing). */
  replay: boolean;
  generatedAt: string;
  network: { cluster: string; programId: string };
  subject: {
    project: string;
    field: string;
    fieldIndex: number;
    crop: string;
    season: number;
    declaredAreaHa: number;
    polygonHash: string;
  };
  kind: AttestationKindName;
  asOf: string;
  window: TimeWindow;
  polygon: PolygonGeometry;
  geometry: GeometryCheck;
  /** The exact Statistical API request body; null when the polygon was invalid and no call was made. */
  request: StatsRequest | null;
  /** The raw Statistical API response. */
  response: unknown;
  scenes: Observation[];
  failedIntervals: FailedInterval[];
  decision: { verdict: VerdictName; ndviMean: number | null; sceneDate: string | null; reasons: string[] };
  onChain: { ndviMeanX10k: number; sceneDate: number };
  signer: string;
}

export interface EncodedEvidence {
  bytes: Uint8Array;
  hash: Uint8Array;
  hashHex: string;
}

export function encodeEvidence(doc: EvidenceDoc): EncodedEvidence {
  const bytes = new TextEncoder().encode(canonicalJson(doc));
  const hash = sha256(bytes);
  return { bytes, hash, hashHex: toHex(hash) };
}

export const evidenceKey = (hashHex: string) => `evidence/${hashHex}.json`;
export const polygonKey = (hashHex: string) => `polygons/${hashHex}.json`;

export function evidenceUri(baseUrl: string, hashHex: string): string {
  const uri = `${baseUrl.replace(/\/+$/, "")}/e/${hashHex}`;
  if (uri.length > MAX_EVIDENCE_URI_LEN) {
    throw new Error(`evidence URI is ${uri.length} bytes; the program allows ${MAX_EVIDENCE_URI_LEN}. Shorten EVIDENCE_BASE_URL.`);
  }
  return uri;
}

export function ndviToX10k(mean: number | null): number {
  if (mean === null) return 0;
  return Math.max(-NDVI_SCALE, Math.min(NDVI_SCALE, Math.round(mean * NDVI_SCALE)));
}

/** Unix seconds of the acquisition day at 00:00 UTC; 0 when there is no scene. */
export function sceneDateToUnix(date: string | null): number {
  if (date === null) return 0;
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
}
```

`apps/scas-worker/src/store.ts`:
```ts
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface BlobStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export class MemoryStore implements BlobStore {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.objects.get(key)?.body ?? null;
  }
}

export interface S3StoreOptions {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** Railway bucket (S3-compatible, private). Keys are content hashes, so writes are idempotent. */
export class S3Store implements BlobStore {
  private readonly client: Pick<S3Client, "send">;

  constructor(
    private readonly opts: S3StoreOptions,
    client?: Pick<S3Client, "send">,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: opts.endpoint,
        region: opts.region,
        forcePathStyle: opts.forcePathStyle,
        credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
        // Newer SDKs add CRC checksums by default; S3-compatible stores may reject them.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      return out.Body ? await out.Body.transformToByteArray() : null;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/evidence.test.ts test/store.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): content-addressed evidence and bucket store"
```

---

### Task 9: Attestation sender

**Files:**
- Create: `apps/scas-worker/src/chain.ts`
- Test: `apps/scas-worker/test/chain.test.ts`

**Interfaces:**
- Consumes: `F2F_IDL`, `F2f`, `configPda`, `fieldPda`, `attestationPda`, `toAnchorEnum`, `AttestationKindName`, `VerdictName` from `@f2f/sdk`; `RequestError`.
- Produces:

```ts
interface FieldState { address: PublicKey; project: PublicKey; index: number; polygonHash: Uint8Array; areaHaX100: number; verified: boolean; attestationCount: number }
interface ProjectState { address: PublicKey; crop: string; season: number }
interface AttestationArgs { project: PublicKey; field: PublicKey; sequence: number; kind: AttestationKindName; verdict: VerdictName; evidenceHash: Uint8Array; evidenceUri: string; ndviMeanX10k: number; sceneDate: number }
interface SentAttestation { signature: string; attestation: PublicKey; sequence: number }
interface Chain {
  readonly scas: PublicKey;
  loadProject(project: PublicKey): Promise<ProjectState>;
  loadField(project: PublicKey, index: number): Promise<FieldState>;
  assertScasAuthority(): Promise<void>;
  sendAttestation(args: Omit<AttestationArgs, "sequence">): Promise<SentAttestation>;
}
function createProgram(connection: Connection, signer: Keypair, programId: PublicKey): Program<F2f>
function buildRecordAttestationIx(program: Program<F2f>, scas: PublicKey, args: AttestationArgs): Promise<TransactionInstruction>
function checkScasAuthority(configScas: PublicKey, signer: PublicKey): void
function createSerialQueue(): <T>(task: () => Promise<T>) => Promise<T>
function createChain(opts: { rpcUrl: string; programId: PublicKey; scas: Keypair }): Chain
```

- [ ] **Step 1: Write the failing test**

`apps/scas-worker/test/chain.test.ts`:
```ts
import { F2F_IDL, attestationPda, configPda } from "@f2f/sdk";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildRecordAttestationIx, checkScasAuthority, createProgram, createSerialQueue } from "../src/chain";

describe("buildRecordAttestationIx", () => {
  // No RPC call happens: every account is passed explicitly.
  const scas = Keypair.generate();
  const programId = Keypair.generate().publicKey; // proves the IDL address is overridden
  const program = createProgram(new Connection("http://127.0.0.1:1"), scas, programId);
  const project = Keypair.generate().publicKey;
  const field = Keypair.generate().publicKey;
  const args = {
    project,
    field,
    sequence: 3,
    kind: "FieldVerified" as const,
    verdict: "Pass" as const,
    evidenceHash: new Uint8Array(32).fill(7),
    evidenceUri: "https://scas.example.app/e/ab",
    ndviMeanX10k: 1900,
    sceneDate: 1789862400,
  };

  it("orders accounts as the program expects and derives the attestation PDA from the sequence", async () => {
    const ix = await buildRecordAttestationIx(program, scas.publicKey, args);
    expect(ix.programId.equals(programId)).toBe(true);
    const keys = ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [scas.publicKey.toBase58(), true, true],
      [configPda(programId).toBase58(), false, false],
      [project.toBase58(), false, true],
      [field.toBase58(), false, true],
      [attestationPda(programId, field, 3).toBase58(), false, true],
      [SystemProgram.programId.toBase58(), false, false],
    ]);
  });

  it("encodes the arguments", async () => {
    const ix = await buildRecordAttestationIx(program, scas.publicKey, args);
    const idlIx = (F2F_IDL as unknown as { instructions: { name: string; discriminator: number[] }[] }).instructions.find(
      (i) => i.name === "record_attestation",
    );
    expect(Array.from(ix.data.subarray(0, 8))).toEqual(idlIx?.discriminator);
    const decoded = program.coder.instruction.decode(ix.data) as {
      name: string;
      data: { kind: object; verdict: object; ndviMeanX10k: number; evidenceUri: string; sceneDate: { toNumber(): number } };
    };
    expect(decoded.name).toBe("recordAttestation");
    expect(decoded.data.kind).toEqual({ fieldVerified: {} });
    expect(decoded.data.verdict).toEqual({ pass: {} });
    expect(decoded.data.ndviMeanX10k).toBe(1900);
    expect(decoded.data.evidenceUri).toBe(args.evidenceUri);
    expect(decoded.data.sceneDate.toNumber()).toBe(1789862400);
  });
});

describe("checkScasAuthority", () => {
  it("names both keys when the signer is not the Config SCAS authority", () => {
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    expect(() => checkScasAuthority(a, a)).not.toThrow();
    expect(() => checkScasAuthority(a, b)).toThrow(new RegExp(`${b.toBase58()}.*${a.toBase58()}`));
  });
});

describe("createSerialQueue", () => {
  it("runs tasks one at a time in submission order, even after a failure", async () => {
    const run = createSerialQueue();
    const events: string[] = [];
    const slow = run(async () => {
      events.push("a:start");
      await new Promise((r) => setTimeout(r, 20));
      events.push("a:end");
      throw new Error("a failed");
    });
    const fast = run(async () => {
      events.push("b:start");
      return "b";
    });
    await expect(slow).rejects.toThrow("a failed");
    await expect(fast).resolves.toBe("b");
    expect(events).toEqual(["a:start", "a:end", "b:start"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/chain.test.ts`
Expected: FAIL, cannot resolve `../src/chain`.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/chain.ts`:
```ts
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import {
  F2F_IDL,
  attestationPda,
  configPda,
  fieldPda,
  toAnchorEnum,
  type AttestationKindName,
  type F2f,
  type VerdictName,
} from "@f2f/sdk";
import { Connection, SystemProgram, type Keypair, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { RequestError } from "./errors";

export interface FieldState {
  address: PublicKey;
  project: PublicKey;
  index: number;
  polygonHash: Uint8Array;
  areaHaX100: number;
  verified: boolean;
  attestationCount: number;
}

export interface ProjectState {
  address: PublicKey;
  crop: string;
  season: number;
}

export interface AttestationArgs {
  project: PublicKey;
  field: PublicKey;
  sequence: number;
  kind: AttestationKindName;
  verdict: VerdictName;
  evidenceHash: Uint8Array;
  evidenceUri: string;
  ndviMeanX10k: number;
  /** Unix seconds. */
  sceneDate: number;
}

export interface SentAttestation {
  signature: string;
  attestation: PublicKey;
  sequence: number;
}

export interface Chain {
  readonly scas: PublicKey;
  loadProject(project: PublicKey): Promise<ProjectState>;
  loadField(project: PublicKey, index: number): Promise<FieldState>;
  assertScasAuthority(): Promise<void>;
  sendAttestation(args: Omit<AttestationArgs, "sequence">): Promise<SentAttestation>;
}

export function createProgram(connection: Connection, signer: Keypair, programId: PublicKey): Program<F2f> {
  const provider = new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
  return new Program<F2f>({ ...F2F_IDL, address: programId.toBase58() } as F2f, provider);
}

function recordAttestation(program: Program<F2f>, scas: PublicKey, args: AttestationArgs) {
  const programId = program.programId;
  return program.methods
    .recordAttestation(
      // Anchor's generated enum types are unions of object literals; the runtime shape is { variant: {} }.
      toAnchorEnum(args.kind) as never,
      toAnchorEnum(args.verdict) as never,
      Array.from(args.evidenceHash),
      args.evidenceUri,
      args.ndviMeanX10k,
      new BN(args.sceneDate),
    )
    .accountsStrict({
      scas,
      config: configPda(programId),
      project: args.project,
      field: args.field,
      attestation: attestationPda(programId, args.field, args.sequence),
      systemProgram: SystemProgram.programId,
    });
}

export function buildRecordAttestationIx(
  program: Program<F2f>,
  scas: PublicKey,
  args: AttestationArgs,
): Promise<TransactionInstruction> {
  return recordAttestation(program, scas, args).instruction();
}

export function checkScasAuthority(configScas: PublicKey, signer: PublicKey): void {
  if (!configScas.equals(signer)) {
    throw new Error(`SCAS key ${signer.toBase58()} is not the Config SCAS authority ${configScas.toBase58()}`);
  }
}

/** Runs async tasks one at a time. Two sends for one Field would otherwise race on attestation_count. */
export function createSerialQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}

export function createChain(opts: { rpcUrl: string; programId: PublicKey; scas: Keypair }): Chain {
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const program = createProgram(connection, opts.scas, opts.programId);
  const serial = createSerialQueue();

  return {
    scas: opts.scas.publicKey,

    async loadProject(project) {
      const acc = await program.account.farmProject.fetchNullable(project);
      if (!acc) throw new RequestError(`project ${project.toBase58()} not found`, 404);
      return { address: project, crop: acc.crop, season: acc.season };
    },

    async loadField(project, index) {
      const address = fieldPda(opts.programId, project, index);
      const acc = await program.account.field.fetchNullable(address);
      if (!acc) throw new RequestError(`field ${index} of project ${project.toBase58()} not found`, 404);
      return {
        address,
        project: acc.project,
        index: acc.index,
        polygonHash: Uint8Array.from(acc.polygonHash),
        areaHaX100: acc.areaHaX100,
        verified: acc.verified,
        attestationCount: acc.attestationCount,
      };
    },

    async assertScasAuthority() {
      const config = await program.account.config.fetch(configPda(opts.programId));
      checkScasAuthority(config.scas, opts.scas.publicKey);
    },

    sendAttestation(args) {
      return serial(async () => {
        // Re-read inside the queue so the PDA uses the count after any earlier send.
        const field = await program.account.field.fetch(args.field);
        const sequence = field.attestationCount;
        const signature = await recordAttestation(program, opts.scas.publicKey, { ...args, sequence }).rpc({
          commitment: "confirmed",
        });
        return { signature, attestation: attestationPda(opts.programId, args.field, sequence), sequence };
      });
    },
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm -C apps/scas-worker exec vitest run test/chain.test.ts && pnpm -C apps/scas-worker exec tsc --noEmit`
Expected: 4 tests pass; tsc prints nothing. If tsc reports that `fetchNullable` result fields are not camelCase, regenerate the IDL copy with `pnpm -C packages/sdk sync-idl`; the field names in `F2f` must be `polygonHash`, `areaHaX100`, `attestationCount`.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): record_attestation sender with serialized sends"
```

---

### Task 10: Orchestrator and polygon upload

**Files:**
- Create: `apps/scas-worker/src/attest.ts`, `apps/scas-worker/src/polygons.ts`
- Test: `apps/scas-worker/test/attest.test.ts`, `test/polygons.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–9.
- Produces:

```ts
interface AttestRequest { project: PublicKey; fieldIndex: number; kind: AttestationKindName; replayDate?: string; polygon?: unknown; dryRun?: boolean }
interface AttestResult {
  kind: AttestationKindName; verdict: VerdictName; reasons: string[]; replay: boolean; asOf: string;
  ndviMean: number | null; ndviMeanX10k: number; sceneDate: string | null; sceneDateUnix: number;
  evidenceHash: string; evidenceUri: string; field: string; dryRun: boolean;
  signature: string | null; attestation: string | null; sequence: number | null;
}
interface AttestDeps { chain: Chain; sentinel: StatsSource; store: BlobStore; evidenceBaseUrl: string; programId: PublicKey; cluster: string; now?: () => Date }
function resolveAsOf(kind: AttestationKindName, replayDate: string | undefined, now: Date): { asOf: Date; replay: boolean }
function runAttestation(deps: AttestDeps, req: AttestRequest): Promise<AttestResult>
interface PolygonUpload { polygonHash: string; areaHa: number; areaHaX100: number; key: string }
function uploadPolygon(store: BlobStore, geojson: unknown): Promise<PolygonUpload>
```

Order inside `runAttestation`, which the tests pin: validate request → read project → refuse inapplicable season rule → read Field → load polygon (request body or bucket) → check polygon hash against the chain → geometry check → Statistical API (only for a valid polygon) → parse → decide → build evidence → (dry run stops here) → store polygon if it came with the request → store evidence → send transaction. Any throw before the last step means nothing is signed.

- [ ] **Step 1: Write the failing tests**

`apps/scas-worker/test/attest.test.ts`:
```ts
import { polygonHash, toHex } from "@f2f/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAsOf, runAttestation, type AttestDeps } from "../src/attest";
import type { AttestationArgs, Chain, FieldState } from "../src/chain";
import { RequestError, SentinelError } from "../src/errors";
import { evidenceKey, polygonKey, type EvidenceDoc } from "../src/evidence";
import { CDSE_TOKEN_URL, SentinelClient, type StatsSource } from "../src/sentinel/client";
import { MemoryStore } from "../src/store";
import clear from "./fixtures/stats-clear.json";
import cloudy from "./fixtures/stats-cloudy.json";
import empty from "./fixtures/stats-empty.json";
import partial from "./fixtures/stats-partial-error.json";
import { BOWTIE, SQUARE, SQUARE_AREA_HA_X100 } from "./helpers";

const PROGRAM_ID = new PublicKey("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");
const PROJECT = Keypair.generate().publicKey;
const FIELD = Keypair.generate().publicKey;
const SCAS = Keypair.generate().publicKey;
const NOW = new Date("2026-10-03T09:00:00Z");

function fakeChain(field: Partial<FieldState> = {}) {
  const sent: Omit<AttestationArgs, "sequence">[] = [];
  const chain: Chain = {
    scas: SCAS,
    loadProject: async () => ({ address: PROJECT, crop: "wheat", season: 2027 }),
    loadField: async (_project, index) => ({
      address: FIELD,
      project: PROJECT,
      index,
      polygonHash: polygonHash(SQUARE),
      areaHaX100: SQUARE_AREA_HA_X100,
      verified: false,
      attestationCount: 0,
      ...field,
    }),
    assertScasAuthority: async () => {},
    sendAttestation: async (args) => {
      sent.push(args);
      return { signature: "sig-1", attestation: Keypair.generate().publicKey, sequence: 0 };
    },
  };
  return { chain, sent };
}

const source = (response: unknown): StatsSource & { calls: number } => {
  const s = {
    calls: 0,
    fetchStats: async () => {
      s.calls += 1;
      return response;
    },
  };
  return s;
};

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
});

function deps(chain: Chain, sentinel: StatsSource): AttestDeps {
  return { chain, sentinel, store, evidenceBaseUrl: "https://scas.example.app", programId: PROGRAM_ID, cluster: "devnet", now: () => NOW };
}

const storedEvidence = (hashHex: string): EvidenceDoc => {
  const bytes = store.objects.get(evidenceKey(hashHex))?.body;
  if (!bytes) throw new Error("evidence not stored");
  return JSON.parse(new TextDecoder().decode(bytes)) as EvidenceDoc;
};

describe("FieldVerified", () => {
  it("clear scene: stores evidence, then signs Pass with the latest clear NDVI", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(clear)), {
      project: PROJECT,
      fieldIndex: 0,
      kind: "FieldVerified",
      polygon: SQUARE,
    });
    expect(result).toMatchObject({
      verdict: "Pass",
      ndviMeanX10k: 1900,
      sceneDate: "2026-09-20",
      sceneDateUnix: 1789862400,
      replay: false,
      signature: "sig-1",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ field: FIELD, kind: "FieldVerified", verdict: "Pass", evidenceUri: result.evidenceUri });
    expect(toHex(sent[0]!.evidenceHash)).toBe(result.evidenceHash);
    const doc = storedEvidence(result.evidenceHash);
    expect(doc.scenes).toHaveLength(3);
    expect(doc.request?.aggregation.aggregationInterval).toEqual({ of: "P1D" });
    expect(store.objects.has(polygonKey(toHex(polygonHash(SQUARE))))).toBe(true);
  });

  it("cloudy scenes: signs InsufficientData with zero NDVI and scene date", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(cloudy)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("InsufficientData");
    expect(sent[0]).toMatchObject({ verdict: "InsufficientData", ndviMeanX10k: 0, sceneDate: 0 });
  });

  it("no scenes: signs InsufficientData", async () => {
    const { chain } = fakeChain();
    const result = await runAttestation(deps(chain, source(empty)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("InsufficientData");
  });

  it("area mismatch: signs Fail", async () => {
    const { chain } = fakeChain({ areaHaX100: 9000 });
    const result = await runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("Fail");
    expect(result.reasons[0]).toMatch(/differs from declared 90 ha/);
  });

  it("invalid polygon: signs Fail without calling the API", async () => {
    const { chain, sent } = fakeChain({ polygonHash: polygonHash(BOWTIE) });
    const sentinel = source(clear);
    const result = await runAttestation(deps(chain, sentinel), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: BOWTIE });
    expect(result.verdict).toBe("Fail");
    expect(sentinel.calls).toBe(0);
    expect(sent).toHaveLength(1);
    expect(storedEvidence(result.evidenceHash).request).toBeNull();
  });

  it("never stores a credential in the evidence", async () => {
    const { chain } = fakeChain();
    const result = await runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    const json = new TextDecoder().decode(store.objects.get(evidenceKey(result.evidenceHash))?.body);
    expect(json).not.toMatch(/Bearer|client_secret|access_token/);
  });
});

describe("failures never sign", () => {
  it("Statistical API failure: rejects, stores no evidence, sends nothing", async () => {
    const { chain, sent } = fakeChain();
    const failing: StatsSource = {
      fetchStats: async () => {
        throw new SentinelError("Statistical API returned 503: down", { retryable: true, status: 503 });
      },
    };
    await expect(
      runAttestation(deps(chain, failing), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE }),
    ).rejects.toBeInstanceOf(SentinelError);
    expect(sent).toHaveLength(0);
    expect([...store.objects.keys()].some((k) => k.startsWith("evidence/"))).toBe(false);
  });

  it("API 500 then success through the real client: signs once", async () => {
    const { chain, sent } = fakeChain();
    let statsCalls = 0;
    const fetch = (async (input: RequestInfo | URL) => {
      if (String(input) === CDSE_TOKEN_URL) return Response.json({ access_token: "t", expires_in: 600 });
      statsCalls += 1;
      return statsCalls === 1 ? new Response("boom", { status: 500 }) : Response.json(clear);
    }) as typeof globalThis.fetch;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    const result = await runAttestation(deps(chain, client), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE });
    expect(result.verdict).toBe("Pass");
    expect(statsCalls).toBe(2);
    expect(sent).toHaveLength(1);
  });

  it("API failing on every attempt through the real client: sends nothing", async () => {
    const { chain, sent } = fakeChain();
    const fetch = (async (input: RequestInfo | URL) =>
      String(input) === CDSE_TOKEN_URL
        ? Response.json({ access_token: "t", expires_in: 600 })
        : new Response("down", { status: 502 })) as typeof globalThis.fetch;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    await expect(
      runAttestation(deps(chain, client), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE }),
    ).rejects.toThrow(/returned 502/);
    expect(sent).toHaveLength(0);
  });

  it("polygon that does not match the on-chain hash: 409 before any API call", async () => {
    const { chain, sent } = fakeChain({ polygonHash: new Uint8Array(32) });
    const sentinel = source(clear);
    await expect(
      runAttestation(deps(chain, sentinel), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified", polygon: SQUARE }),
    ).rejects.toMatchObject({ status: 409 });
    expect(sentinel.calls).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("no polygon in the request and none stored: 404", async () => {
    const { chain } = fakeChain();
    await expect(
      runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("polygon from the bucket, dry run and replay", () => {
  it("loads the polygon stored under the on-chain hash", async () => {
    const { chain, sent } = fakeChain();
    await store.put(polygonKey(toHex(polygonHash(SQUARE))), new TextEncoder().encode(JSON.stringify(SQUARE)), "application/geo+json");
    await runAttestation(deps(chain, source(clear)), { project: PROJECT, fieldIndex: 0, kind: "FieldVerified" });
    expect(sent).toHaveLength(1);
  });

  it("dry run computes the evidence hash but stores and signs nothing", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(clear)), {
      project: PROJECT,
      fieldIndex: 0,
      kind: "FieldVerified",
      polygon: SQUARE,
      dryRun: true,
    });
    expect(result).toMatchObject({ dryRun: true, signature: null, verdict: "Pass" });
    expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.objects.size).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("replays last season's Vegetation and labels the evidence", async () => {
    const { chain, sent } = fakeChain();
    const result = await runAttestation(deps(chain, source(partial)), {
      project: PROJECT,
      fieldIndex: 0,
      kind: "Vegetation",
      replayDate: "2026-07-12",
      polygon: SQUARE,
    });
    expect(result).toMatchObject({ verdict: "Pass", replay: true, asOf: "2026-07-12", ndviMeanX10k: 7200 });
    expect(sent[0]?.sceneDate).toBe(1783641600);
    const doc = storedEvidence(result.evidenceHash);
    expect(doc.replay).toBe(true);
    expect(doc.window).toEqual({ from: "2026-06-23T00:00:00Z", to: "2026-07-13T00:00:00Z" });
    expect(doc.failedIntervals).toHaveLength(1);
  });
});

describe("resolveAsOf", () => {
  it("uses now without a replay date", () => {
    expect(resolveAsOf("FieldVerified", undefined, NOW)).toEqual({ asOf: NOW, replay: false });
  });

  it("refuses a replay date for FieldVerified, malformed or impossible dates, and future dates", () => {
    expect(() => resolveAsOf("FieldVerified", "2026-07-12", NOW)).toThrow(RequestError);
    expect(() => resolveAsOf("Vegetation", "12.07.2026", NOW)).toThrow(/YYYY-MM-DD/);
    expect(() => resolveAsOf("Vegetation", "2026-02-30", NOW)).toThrow(/YYYY-MM-DD/);
    expect(() => resolveAsOf("Vegetation", "2027-07-12", NOW)).toThrow(/future/);
  });
});
```

`apps/scas-worker/test/polygons.test.ts`:
```ts
import { polygonHashHex } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { polygonKey } from "../src/evidence";
import { uploadPolygon } from "../src/polygons";
import { MemoryStore } from "../src/store";
import { BOWTIE, SQUARE } from "./helpers";

describe("uploadPolygon", () => {
  it("stores the canonical polygon under its hash and reports the area", async () => {
    const store = new MemoryStore();
    const feature = { type: "Feature", properties: {}, geometry: SQUARE };
    const up = await uploadPolygon(store, feature);
    expect(up.polygonHash).toBe(polygonHashHex(SQUARE));
    expect(up.areaHaX100).toBe(7611);
    expect(up.key).toBe(polygonKey(up.polygonHash));
    expect(store.objects.get(up.key)?.contentType).toBe("application/geo+json");
  });

  it("rejects malformed GeoJSON and invalid polygons with 422", async () => {
    const store = new MemoryStore();
    await expect(uploadPolygon(store, { type: "Point", coordinates: [69, 52] })).rejects.toMatchObject({ status: 422 });
    await expect(uploadPolygon(store, BOWTIE)).rejects.toMatchObject({ status: 422 });
    expect(store.objects.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C apps/scas-worker exec vitest run test/attest.test.ts test/polygons.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/polygons.ts`:
```ts
import { canonicalJson, normalizePolygon, polygonHashHex, type PolygonGeometry } from "@f2f/sdk";
import { RequestError } from "./errors";
import { polygonKey } from "./evidence";
import { checkPolygon } from "./geometry";
import type { BlobStore } from "./store";

export interface PolygonUpload {
  polygonHash: string;
  areaHa: number;
  areaHaX100: number;
  key: string;
}

export function parsePolygon(geojson: unknown): PolygonGeometry {
  try {
    return normalizePolygon(geojson);
  } catch (err) {
    throw new RequestError(`polygon is not valid GeoJSON: ${(err as Error).message}`, 422);
  }
}

export async function storePolygon(store: BlobStore, polygon: PolygonGeometry): Promise<string> {
  const key = polygonKey(polygonHashHex(polygon));
  await store.put(key, new TextEncoder().encode(canonicalJson(polygon)), "application/geo+json");
  return key;
}

/** Called by the web app before register_field so SCAS can later find the polygon by its on-chain hash. */
export async function uploadPolygon(store: BlobStore, geojson: unknown): Promise<PolygonUpload> {
  const polygon = parsePolygon(geojson);
  const check = checkPolygon(polygon);
  if (!check.valid) throw new RequestError(`polygon rejected: ${check.reasons.join("; ")}`, 422);
  const key = await storePolygon(store, polygon);
  return {
    polygonHash: polygonHashHex(polygon),
    areaHa: check.areaHa,
    areaHaX100: Math.round(check.areaHa * 100),
    key,
  };
}
```

`apps/scas-worker/src/attest.ts`:
```ts
import { polygonHashHex, toHex, type AttestationKindName, type VerdictName } from "@f2f/sdk";
import type { PublicKey } from "@solana/web3.js";
import type { Chain } from "./chain";
import { RequestError } from "./errors";
import {
  EVIDENCE_SCHEMA,
  encodeEvidence,
  evidenceKey,
  evidenceUri,
  ndviToX10k,
  polygonKey,
  sceneDateToUnix,
  type EvidenceDoc,
} from "./evidence";
import { checkPolygon } from "./geometry";
import { parsePolygon, storePolygon } from "./polygons";
import { RULES_VERSION, WINDOW_DAYS, assertRuleApplicable, decide } from "./rules/verdict";
import type { StatsSource } from "./sentinel/client";
import { parseStats, type ParsedStats } from "./sentinel/parse";
import { buildStatsRequest, windowEndingAt, type StatsRequest } from "./sentinel/request";
import type { BlobStore } from "./store";

export interface AttestRequest {
  project: PublicKey;
  fieldIndex: number;
  kind: AttestationKindName;
  /** YYYY-MM-DD in a past season; only for Sowing, Vegetation, Harvest. */
  replayDate?: string;
  /** GeoJSON; when absent the polygon is read from the bucket by the Field's on-chain hash. */
  polygon?: unknown;
  dryRun?: boolean;
}

export interface AttestResult {
  kind: AttestationKindName;
  verdict: VerdictName;
  reasons: string[];
  replay: boolean;
  asOf: string;
  ndviMean: number | null;
  ndviMeanX10k: number;
  sceneDate: string | null;
  sceneDateUnix: number;
  evidenceHash: string;
  evidenceUri: string;
  field: string;
  dryRun: boolean;
  signature: string | null;
  attestation: string | null;
  sequence: number | null;
}

export interface AttestDeps {
  chain: Chain;
  sentinel: StatsSource;
  store: BlobStore;
  evidenceBaseUrl: string;
  programId: PublicKey;
  cluster: string;
  now?: () => Date;
}

export function resolveAsOf(kind: AttestationKindName, replayDate: string | undefined, now: Date): { asOf: Date; replay: boolean } {
  if (replayDate === undefined) return { asOf: now, replay: false };
  if (kind === "FieldVerified") throw new RequestError("FieldVerified uses current imagery; a replay date is not allowed");
  const ms = Date.parse(`${replayDate}T00:00:00Z`);
  // Date.parse rolls 2026-02-30 over to March, so round-trip to reject impossible days.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(replayDate) || Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== replayDate) {
    throw new RequestError(`replay date must be YYYY-MM-DD, got "${replayDate}"`);
  }
  const asOf = new Date(`${replayDate}T12:00:00Z`);
  if (asOf.getTime() > now.getTime()) throw new RequestError("replay date is in the future");
  return { asOf, replay: true };
}

async function loadPolygon(store: BlobStore, req: AttestRequest, onChainHash: string): Promise<unknown> {
  if (req.polygon !== undefined) return req.polygon;
  const bytes = await store.get(polygonKey(onChainHash));
  if (!bytes) {
    throw new RequestError(`no stored polygon for hash ${onChainHash}; upload it with POST /polygons or pass --polygon`, 404);
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export async function runAttestation(deps: AttestDeps, req: AttestRequest): Promise<AttestResult> {
  const now = (deps.now ?? (() => new Date()))();
  const { asOf, replay } = resolveAsOf(req.kind, req.replayDate, now);

  const project = await deps.chain.loadProject(req.project);
  assertRuleApplicable(req.kind, project.crop, asOf);
  const field = await deps.chain.loadField(req.project, req.fieldIndex);

  const onChainHash = toHex(field.polygonHash);
  const polygon = parsePolygon(await loadPolygon(deps.store, req, onChainHash));
  const hashHex = polygonHashHex(polygon);
  if (hashHex !== onChainHash) {
    throw new RequestError(`polygon hash ${hashHex} does not match the Field's on-chain hash ${onChainHash}`, 409);
  }

  const geometry = checkPolygon(polygon);
  const window = windowEndingAt(asOf, WINDOW_DAYS[req.kind]);
  let request: StatsRequest | null = null;
  let response: unknown = null;
  let parsed: ParsedStats = { observations: [], failedIntervals: [], polygonPixels: 0 };
  if (geometry.valid) {
    request = buildStatsRequest(polygon, window);
    response = await deps.sentinel.fetchStats(request); // throws on failure: nothing below runs
    parsed = parseStats(response); // throws on an unusable response
  }

  const decision = decide({
    kind: req.kind,
    crop: project.crop,
    asOf,
    geometry,
    declaredAreaHa: field.areaHaX100 / 100,
    observations: parsed.observations,
  });
  const ndviMeanX10k = ndviToX10k(decision.ndviMean);
  const sceneDateUnix = sceneDateToUnix(decision.sceneDate);
  const asOfDay = asOf.toISOString().slice(0, 10);

  const doc: EvidenceDoc = {
    schema: EVIDENCE_SCHEMA,
    rulesVersion: RULES_VERSION,
    replay,
    generatedAt: now.toISOString(),
    network: { cluster: deps.cluster, programId: deps.programId.toBase58() },
    subject: {
      project: req.project.toBase58(),
      field: field.address.toBase58(),
      fieldIndex: req.fieldIndex,
      crop: project.crop,
      season: project.season,
      declaredAreaHa: field.areaHaX100 / 100,
      polygonHash: onChainHash,
    },
    kind: req.kind,
    asOf: asOfDay,
    window,
    polygon,
    geometry,
    request,
    response,
    scenes: parsed.observations,
    failedIntervals: parsed.failedIntervals,
    decision,
    onChain: { ndviMeanX10k, sceneDate: sceneDateUnix },
    signer: deps.chain.scas.toBase58(),
  };
  const encoded = encodeEvidence(doc);
  const uri = evidenceUri(deps.evidenceBaseUrl, encoded.hashHex);

  const result: AttestResult = {
    kind: req.kind,
    verdict: decision.verdict,
    reasons: decision.reasons,
    replay,
    asOf: asOfDay,
    ndviMean: decision.ndviMean,
    ndviMeanX10k,
    sceneDate: decision.sceneDate,
    sceneDateUnix,
    evidenceHash: encoded.hashHex,
    evidenceUri: uri,
    field: field.address.toBase58(),
    dryRun: req.dryRun === true,
    signature: null,
    attestation: null,
    sequence: null,
  };
  if (req.dryRun) return result;

  if (req.polygon !== undefined) await storePolygon(deps.store, polygon);
  await deps.store.put(evidenceKey(encoded.hashHex), encoded.bytes, "application/json");
  const sent = await deps.chain.sendAttestation({
    project: req.project,
    field: field.address,
    kind: req.kind,
    verdict: decision.verdict,
    evidenceHash: encoded.hash,
    evidenceUri: uri,
    ndviMeanX10k,
    sceneDate: sceneDateUnix,
  });
  return { ...result, signature: sent.signature, attestation: sent.attestation.toBase58(), sequence: sent.sequence };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/attest.test.ts test/polygons.test.ts`
Expected: 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): attestation orchestrator and polygon upload"
```

---

### Task 11: HTTP endpoint

**Files:**
- Create: `apps/scas-worker/src/http.ts`
- Test: `apps/scas-worker/test/http.test.ts`

**Interfaces:**
- Consumes: `AttestRequest`, `AttestResult`, `PolygonUpload`, `BlobStore`, `evidenceKey`, `RequestError`, `SentinelError`, `parseKind`, `sha256`, `toHex`.
- Produces: `interface HttpDeps { attest(req: AttestRequest): Promise<AttestResult>; putPolygon(geojson: unknown): Promise<PolygonUpload>; store: BlobStore; apiToken: string; scas: PublicKey; version: string; reportError?(err: unknown): void }`, `tokenMatches(expected: string, header: string | undefined): boolean`, `createApp(deps: HttpDeps): Hono`.

Routes:

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | `{ ok, scas, version }` for Railway healthchecks |
| `POST /attest` | bearer | body `{ project, fieldIndex, kind, replayDate?, dryRun? }` → `AttestResult` |
| `POST /polygons` | bearer | body GeoJSON → `PolygonUpload` |
| `GET /e/:hash` | none | evidence JSON proxied from the private bucket, hash-checked |

Errors: `RequestError` → its status; invalid body or kind → 400; `SentinelError` → 502; anything else → 500 and GlitchTip.

- [ ] **Step 1: Write the failing test**

`apps/scas-worker/test/http.test.ts`:
```ts
import { sha256, toHex } from "@f2f/sdk";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { AttestRequest, AttestResult } from "../src/attest";
import { RequestError, SentinelError } from "../src/errors";
import { evidenceKey } from "../src/evidence";
import { createApp, tokenMatches, type HttpDeps } from "../src/http";
import { MemoryStore } from "../src/store";

const TOKEN = "k".repeat(40);
const PROJECT = Keypair.generate().publicKey.toBase58();
const RESULT = { verdict: "Pass", evidenceHash: "ab".repeat(32) } as unknown as AttestResult;

function setup(over: Partial<HttpDeps> = {}) {
  const store = new MemoryStore();
  const deps: HttpDeps = {
    attest: vi.fn(async (_req: AttestRequest) => RESULT),
    putPolygon: vi.fn(async () => ({ polygonHash: "cd".repeat(32), areaHa: 76.11, areaHaX100: 7611, key: "polygons/x.json" })),
    store,
    apiToken: TOKEN,
    scas: Keypair.generate().publicKey,
    version: "test",
    reportError: vi.fn(),
    ...over,
  };
  return { app: createApp(deps), deps, store };
}

const post = (body: unknown, token: string | null = TOKEN) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

describe("tokenMatches", () => {
  it("compares bearer tokens", () => {
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}`)).toBe(true);
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}x`)).toBe(false);
    expect(tokenMatches(TOKEN, TOKEN)).toBe(false);
    expect(tokenMatches(TOKEN, undefined)).toBe(false);
  });
});

describe("HTTP app", () => {
  it("serves health without auth", async () => {
    const { app } = setup();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, version: "test" });
  });

  it("rejects /attest without a valid token", async () => {
    const { app, deps } = setup();
    expect((await app.request("/attest", post({}, null))).status).toBe(401);
    expect((await app.request("/attest", post({}, "wrong"))).status).toBe(401);
    expect(deps.attest).not.toHaveBeenCalled();
  });

  it("validates the body and the kind", async () => {
    const { app } = setup();
    expect((await app.request("/attest", post({ project: PROJECT, fieldIndex: 300, kind: "Vegetation" }))).status).toBe(400);
    expect((await app.request("/attest", post({ project: "nope", fieldIndex: 0, kind: "Vegetation" }))).status).toBe(400);
    expect((await app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "rain" }))).status).toBe(400);
  });

  it("passes a parsed request to the orchestrator", async () => {
    const { app, deps } = setup();
    const res = await app.request("/attest", post({ project: PROJECT, fieldIndex: 1, kind: "vegetation", replayDate: "2026-07-12" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULT);
    const req = vi.mocked(deps.attest).mock.calls[0]?.[0];
    expect(req?.project.toBase58()).toBe(PROJECT);
    expect(req).toMatchObject({ fieldIndex: 1, kind: "Vegetation", replayDate: "2026-07-12" });
  });

  it("maps RequestError to its status and SentinelError to 502", async () => {
    const conflict = setup({ attest: async () => { throw new RequestError("hash mismatch", 409); } });
    expect((await conflict.app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }))).status).toBe(409);

    const down = setup({ attest: async () => { throw new SentinelError("Statistical API returned 503", { retryable: true }); } });
    const res = await down.app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }));
    expect(res.status).toBe(502);
    expect(down.deps.reportError).toHaveBeenCalled();
  });

  it("hides unexpected errors behind 500 and reports them", async () => {
    const { app, deps } = setup({ attest: async () => { throw new Error("rpc exploded"); } });
    const res = await app.request("/attest", post({ project: PROJECT, fieldIndex: 0, kind: "FieldVerified" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
    expect(deps.reportError).toHaveBeenCalled();
  });

  it("uploads polygons behind auth", async () => {
    const { app, deps } = setup();
    expect((await app.request("/polygons", post({ type: "Polygon" }, null))).status).toBe(401);
    const res = await app.request("/polygons", post({ type: "Polygon" }));
    expect(res.status).toBe(200);
    expect(deps.putPolygon).toHaveBeenCalledWith({ type: "Polygon" });
  });

  it("serves evidence by hash and checks it", async () => {
    const { app, store } = setup();
    const bytes = new TextEncoder().encode('{"a":1}');
    const hash = toHex(sha256(bytes));
    await store.put(evidenceKey(hash), bytes, "application/json");

    const ok = await app.request(`/e/${hash}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect(await ok.text()).toBe('{"a":1}');

    expect((await app.request(`/e/${"0".repeat(64)}`)).status).toBe(404);
    expect((await app.request("/e/not-a-hash")).status).toBe(400);

    await store.put(evidenceKey("1".repeat(64)), bytes, "application/json");
    expect((await app.request(`/e/${"1".repeat(64)}`)).status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/http.test.ts`
Expected: FAIL, cannot resolve `../src/http`.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/http.ts`:
```ts
import { createHash, timingSafeEqual } from "node:crypto";
import { parseKind, sha256, toHex } from "@f2f/sdk";
import { PublicKey } from "@solana/web3.js";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AttestRequest, AttestResult } from "./attest";
import { RequestError, SentinelError } from "./errors";
import { evidenceKey } from "./evidence";
import type { PolygonUpload } from "./polygons";
import type { BlobStore } from "./store";

export interface HttpDeps {
  attest(req: AttestRequest): Promise<AttestResult>;
  putPolygon(geojson: unknown): Promise<PolygonUpload>;
  store: BlobStore;
  apiToken: string;
  scas: PublicKey;
  version: string;
  reportError?(err: unknown): void;
}

const AttestBody = z.object({
  project: z.string().min(32).max(44),
  fieldIndex: z.number().int().min(0).max(255),
  kind: z.string().min(1),
  replayDate: z.string().optional(),
  dryRun: z.boolean().optional(),
});

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time comparison of `Authorization: Bearer <token>`. */
export function tokenMatches(expected: string, header: string | undefined): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(expected));
}

export function createApp(deps: HttpDeps): Hono {
  const app = new Hono();

  const auth: MiddlewareHandler = async (c, next) => {
    if (!tokenMatches(deps.apiToken, c.req.header("authorization"))) return c.json({ error: "unauthorized" }, 401);
    await next();
  };

  app.get("/health", (c) => c.json({ ok: true, scas: deps.scas.toBase58(), version: deps.version }));

  app.get("/e/:hash", async (c) => {
    const hash = c.req.param("hash");
    if (!/^[0-9a-f]{64}$/.test(hash)) return c.json({ error: "evidence hash must be 64 lowercase hex characters" }, 400);
    const bytes = await deps.store.get(evidenceKey(hash));
    if (!bytes) return c.json({ error: "evidence not found" }, 404);
    if (toHex(sha256(bytes)) !== hash) {
      deps.reportError?.(new Error(`stored evidence ${hash} failed its hash check`));
      return c.json({ error: "stored evidence does not match its hash" }, 502);
    }
    return c.body(bytes.slice(), 200, {
      "content-type": "application/json",
      "cache-control": "public, max-age=31536000, immutable",
    });
  });

  app.use("/attest", auth);
  app.use("/polygons", auth);

  app.post("/attest", async (c) => {
    const body = AttestBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid body", issues: body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
    }
    let project: PublicKey;
    try {
      project = new PublicKey(body.data.project);
    } catch {
      return c.json({ error: "project is not a valid public key" }, 400);
    }
    const result = await deps.attest({
      project,
      fieldIndex: body.data.fieldIndex,
      kind: parseKind(body.data.kind),
      replayDate: body.data.replayDate,
      dryRun: body.data.dryRun,
    });
    return c.json(result);
  });

  app.post("/polygons", async (c) => c.json(await deps.putPolygon(await c.req.json().catch(() => null))));

  app.onError((err, c) => {
    if (err instanceof RequestError) return c.json({ error: err.message }, err.status);
    if (err instanceof RangeError) return c.json({ error: err.message }, 400);
    deps.reportError?.(err);
    if (err instanceof SentinelError) return c.json({ error: `satellite data unavailable: ${err.message}` }, 502);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C apps/scas-worker exec vitest run test/http.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): HTTP endpoint for the admin view and evidence proxy"
```

---

### Task 12: CLI, entry point and GlitchTip

**Files:**
- Create: `apps/scas-worker/src/cli.ts`, `apps/scas-worker/src/sentry.ts`, `apps/scas-worker/src/main.ts`
- Test: `apps/scas-worker/test/cli.test.ts`

**Interfaces:**
- Consumes: `runAttestation`, `uploadPolygon`, `createApp`, `createChain`, `SentinelClient`, `S3Store`, `buildStatsRequest`, `windowEndingAt`, `loadConfig`, `loadCdseConfig`, `parseKind`.
- Produces: `interface CliRuntime { attest(req: AttestRequest): Promise<AttestResult>; putPolygon(geojson: unknown): Promise<PolygonUpload>; stats(polygon: unknown, asOf: Date, days: number): Promise<unknown>; serve(): Promise<void>; print(text: string): void; printError(text: string): void }`, `buildCli(rt: CliRuntime): Command`; `initSentry(opts: { dsn?: string; environment: string }): void`, `reportError(err: unknown): void`, `flushSentry(): Promise<void>`.

Commands:
```
scas attest --project <pubkey> --field <index> --kind <kind> [--replay-date YYYY-MM-DD] [--polygon <file>] [--dry-run]
scas polygon put <file>
scas stats <file> --to YYYY-MM-DD [--days N]     raw Statistical API response, needs only CDSE credentials
scas serve
```

- [ ] **Step 1: Write the failing test**

`apps/scas-worker/test/cli.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { AttestResult } from "../src/attest";
import { buildCli, type CliRuntime } from "../src/cli";
import { SQUARE } from "./helpers";

const PROJECT = Keypair.generate().publicKey.toBase58();

function runtime(): CliRuntime & { out: string[] } {
  const out: string[] = [];
  return {
    out,
    attest: vi.fn(async () => ({ verdict: "Pass" }) as unknown as AttestResult),
    putPolygon: vi.fn(async () => ({ polygonHash: "ab", areaHa: 1, areaHaX100: 100, key: "polygons/ab.json" })),
    stats: vi.fn(async () => ({ data: [] })),
    serve: vi.fn(async () => {}),
    print: (t) => out.push(t),
    printError: () => {},
  };
}

const argv = (...args: string[]) => ["node", "scas", ...args];

describe("scas CLI", () => {
  it("attest parses project, field, kind and replay date", async () => {
    const rt = runtime();
    await buildCli(rt).parseAsync(
      argv("attest", "--project", PROJECT, "--field", "1", "--kind", "vegetation", "--replay-date", "2026-07-12"),
    );
    const req = vi.mocked(rt.attest).mock.calls[0]?.[0];
    expect(req?.project.toBase58()).toBe(PROJECT);
    expect(req).toMatchObject({ fieldIndex: 1, kind: "Vegetation", replayDate: "2026-07-12", dryRun: false });
    expect(rt.out[0]).toContain('"verdict": "Pass"');
  });

  it("attest reads a polygon file and honors --dry-run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scas-"));
    const file = join(dir, "field.geojson");
    writeFileSync(file, JSON.stringify(SQUARE));
    const rt = runtime();
    await buildCli(rt).parseAsync(argv("attest", "--project", PROJECT, "--field", "0", "--kind", "FieldVerified", "--polygon", file, "--dry-run"));
    expect(vi.mocked(rt.attest).mock.calls[0]?.[0]).toMatchObject({ polygon: SQUARE, dryRun: true });
  });

  it("rejects an unknown kind and a field index out of range", async () => {
    const rt = runtime();
    await expect(buildCli(rt).parseAsync(argv("attest", "--project", PROJECT, "--field", "0", "--kind", "rain"))).rejects.toThrow();
    await expect(buildCli(rt).parseAsync(argv("attest", "--project", PROJECT, "--field", "256", "--kind", "Sowing"))).rejects.toThrow();
    expect(rt.attest).not.toHaveBeenCalled();
  });

  it("polygon put uploads a file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scas-"));
    const file = join(dir, "field.geojson");
    writeFileSync(file, JSON.stringify(SQUARE));
    const rt = runtime();
    await buildCli(rt).parseAsync(argv("polygon", "put", file));
    expect(rt.putPolygon).toHaveBeenCalledWith(SQUARE);
  });

  it("stats passes the window to the runtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scas-"));
    const file = join(dir, "field.geojson");
    writeFileSync(file, JSON.stringify(SQUARE));
    const rt = runtime();
    await buildCli(rt).parseAsync(argv("stats", file, "--to", "2026-09-30", "--days", "30"));
    expect(rt.stats).toHaveBeenCalledWith(SQUARE, new Date("2026-09-30T12:00:00Z"), 30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/scas-worker exec vitest run test/cli.test.ts`
Expected: FAIL, cannot resolve `../src/cli`.

- [ ] **Step 3: Implement**

`apps/scas-worker/src/cli.ts`:
```ts
import { readFile } from "node:fs/promises";
import { parseKind, type AttestationKindName } from "@f2f/sdk";
import { PublicKey } from "@solana/web3.js";
import { Command, InvalidArgumentError } from "commander";
import type { AttestRequest, AttestResult } from "./attest";
import type { PolygonUpload } from "./polygons";

export interface CliRuntime {
  attest(req: AttestRequest): Promise<AttestResult>;
  putPolygon(geojson: unknown): Promise<PolygonUpload>;
  stats(polygon: unknown, asOf: Date, days: number): Promise<unknown>;
  serve(): Promise<void>;
  print(text: string): void;
  printError(text: string): void;
}

function fieldIndex(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new InvalidArgumentError("field index must be an integer 0-255");
  return n;
}

function kind(value: string): AttestationKindName {
  try {
    return parseKind(value);
  } catch (err) {
    throw new InvalidArgumentError((err as Error).message);
  }
}

function positiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 366) throw new InvalidArgumentError("days must be an integer 1-366");
  return n;
}

function day(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InvalidArgumentError("date must be YYYY-MM-DD");
  return new Date(`${value}T12:00:00Z`);
}

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8")) as unknown;
const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export function buildCli(rt: CliRuntime): Command {
  const program = new Command("scas")
    .description("Field-to-Finance SCAS worker: Sentinel-2 checks and signed Attestations")
    .exitOverride()
    .configureOutput({ writeOut: (s) => rt.print(s), writeErr: (s) => rt.printError(s) });

  program
    .command("attest")
    .description("compute a verdict for a Field and sign record_attestation")
    .requiredOption("--project <pubkey>", "FarmProject account address")
    .requiredOption("--field <index>", "Field index within the project", fieldIndex)
    .requiredOption("--kind <kind>", "FieldVerified | Sowing | Vegetation | Harvest", kind)
    .option("--replay-date <YYYY-MM-DD>", "replay a past season as of this day (not for FieldVerified)")
    .option("--polygon <file>", "GeoJSON file; defaults to the polygon stored under the Field's hash")
    .option("--dry-run", "compute and print, do not store or sign", false)
    .action(
      async (opts: { project: string; field: number; kind: AttestationKindName; replayDate?: string; polygon?: string; dryRun: boolean }) => {
        const result = await rt.attest({
          project: new PublicKey(opts.project),
          fieldIndex: opts.field,
          kind: opts.kind,
          replayDate: opts.replayDate,
          polygon: opts.polygon ? await readJson(opts.polygon) : undefined,
          dryRun: opts.dryRun,
        });
        rt.print(pretty(result));
      },
    );

  program
    .command("polygon")
    .description("manage stored field polygons")
    .command("put")
    .description("validate and store a GeoJSON polygon under its hash")
    .argument("<file>", "GeoJSON file")
    .action(async (file: string) => {
      rt.print(pretty(await rt.putPolygon(await readJson(file))));
    });

  program
    .command("stats")
    .description("print the raw Statistical API response for a polygon (for fixtures and debugging)")
    .argument("<file>", "GeoJSON file")
    .requiredOption("--to <YYYY-MM-DD>", "last day of the window", day)
    .option("--days <n>", "window length in days", positiveInt, 30)
    .action(async (file: string, opts: { to: Date; days: number }) => {
      rt.print(pretty(await rt.stats(await readJson(file), opts.to, opts.days)));
    });

  program
    .command("serve")
    .description("start the HTTP server")
    .action(async () => {
      await rt.serve();
    });

  return program;
}
```

`apps/scas-worker/src/sentry.ts`:
```ts
import * as Sentry from "@sentry/node";

let enabled = false;

/** GlitchTip, organization `personal`, speaks the Sentry protocol. No DSN means console only. */
export function initSentry(opts: { dsn?: string; environment: string }): void {
  if (!opts.dsn) return;
  Sentry.init({ dsn: opts.dsn, environment: opts.environment, tracesSampleRate: 0, sendDefaultPii: false });
  enabled = true;
}

export function reportError(err: unknown): void {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  if (enabled) Sentry.captureException(err);
}

export async function flushSentry(): Promise<void> {
  if (enabled) await Sentry.flush(2000);
}
```

`apps/scas-worker/src/main.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, typecheck and build**

Run: `pnpm -C apps/scas-worker exec vitest run && pnpm -C apps/scas-worker exec tsc --noEmit && pnpm -C apps/scas-worker exec tsup && node apps/scas-worker/dist/main.cjs --help`
Expected: all 13 worker test files pass (about 88 tests); tsc prints nothing; tsup writes `dist/main.cjs`; `--help` lists `attest`, `polygon`, `stats`, `serve`.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker
git commit -m "feat(scas): CLI, entry point and GlitchTip reporting"
```

---

### Task 13: Docker image, Railway service and secrets

**Files:**
- Create: `apps/scas-worker/Dockerfile`, `.dockerignore`
- Modify: `apps/scas-worker/.env.example` only if a variable changed

**Interfaces:**
- Consumes: `pnpm --filter @f2f/scas-worker build` from Task 12, `GET /health`.
- Produces: a Railway service `scas-worker` in the F2F project ("Yesset's projects" workspace) with a public domain, a bucket `f2f-evidence`, and variables synced from Infisical.

Environment variables:

| Variable | Source | Notes |
| --- | --- | --- |
| `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` | Infisical | CDSE dashboard → User Settings → OAuth clients |
| `SOLANA_RPC_URL`, `SOLANA_CLUSTER` | Railway literal | `https://api.devnet.solana.com`, `devnet` |
| `SCAS_SECRET_KEY` | Infisical | SCAS keypair, base58 or JSON array; must equal `Config.scas` on devnet |
| `F2F_PROGRAM_ID` | Railway literal | `9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm` |
| `BUCKET_NAME`, `BUCKET_ENDPOINT`, `BUCKET_REGION`, `BUCKET_ACCESS_KEY_ID`, `BUCKET_SECRET_ACCESS_KEY` | Railway references to the bucket | `${{f2f-evidence.BUCKET}}`, `${{f2f-evidence.ENDPOINT}}`, `${{f2f-evidence.REGION}}`, `${{f2f-evidence.ACCESS_KEY_ID}}`, `${{f2f-evidence.SECRET_ACCESS_KEY}}` |
| `BUCKET_FORCE_PATH_STYLE` | Railway literal | `false` unless the bucket's Credentials tab says path-style |
| `EVIDENCE_BASE_URL` | Railway reference | `https://${{RAILWAY_PUBLIC_DOMAIN}}`; at most 61 characters |
| `WORKER_API_TOKEN` | Infisical | `openssl rand -hex 32`; the web app holds the same value |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Infisical / literal | GlitchTip project `f2f-scas-worker` in org `personal`; `production` |
| `RAILWAY_DOCKERFILE_PATH` | Railway literal | `apps/scas-worker/Dockerfile` |

- [ ] **Step 1: Write the Dockerfile and ignore file**

`apps/scas-worker/Dockerfile`:
```dockerfile
# Build context: repository root. Railway: set RAILWAY_DOCKERFILE_PATH=apps/scas-worker/Dockerfile.
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@f2f/scas-worker..."
RUN pnpm --filter @f2f/scas-worker run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "apps/scas-worker/dist/main.cjs", "serve"]
```

`.dockerignore` (repository root):
```
.git
**/node_modules
**/dist
anchor/target
.nx
.env
.env.*
*.keypair.json
id.json
```

- [ ] **Step 2: Build and run the image locally**

Run:
```bash
docker build -f apps/scas-worker/Dockerfile -t f2f-scas-worker .
infisical run --env=dev --path=/scas-worker -- \
  docker run --rm -p 8080:8080 -e CDSE_CLIENT_ID -e CDSE_CLIENT_SECRET -e SOLANA_RPC_URL -e SCAS_SECRET_KEY \
  -e F2F_PROGRAM_ID -e BUCKET_NAME -e BUCKET_ENDPOINT -e BUCKET_ACCESS_KEY_ID -e BUCKET_SECRET_ACCESS_KEY \
  -e EVIDENCE_BASE_URL -e WORKER_API_TOKEN -e SENTRY_DSN f2f-scas-worker
curl -s localhost:8080/health
```
Expected: `{"ok":true,"scas":"<SCAS pubkey>","version":"dev"}`. If Docker is not installed locally, skip to Step 4 and check the Railway deploy logs instead.

- [ ] **Step 3: Create secrets (values never leave Infisical)**

```bash
# SCAS keypair: write to a temp file, store the JSON array in Infisical, delete the file.
solana-keygen new --no-bip39-passphrase --silent -o /tmp/scas.json
solana-keygen pubkey /tmp/scas.json          # record this pubkey for init_config on devnet
infisical secrets set --env=dev --path=/scas-worker SCAS_SECRET_KEY="$(cat /tmp/scas.json)" >/dev/null
infisical secrets set --env=prod --path=/scas-worker SCAS_SECRET_KEY="$(cat /tmp/scas.json)" >/dev/null
rm /tmp/scas.json

TOKEN="$(openssl rand -hex 32)"
infisical secrets set --env=prod --path=/scas-worker WORKER_API_TOKEN="$TOKEN" >/dev/null
infisical secrets set --env=dev --path=/scas-worker WORKER_API_TOKEN="$TOKEN" >/dev/null
unset TOKEN

# GlitchTip project in org personal (see ~/.claude/CLAUDE.md), then store its DSN.
API="$GLITCHTIP_URL/api/0"; H=(-H "Authorization: Bearer $GLITCHTIP_TOKEN" -H "Content-Type: application/json")
curl -sS "${H[@]}" -X POST "$API/organizations/personal/teams/" -d '{"slug":"f2f"}' >/dev/null
curl -sS "${H[@]}" -X POST "$API/teams/personal/f2f/projects/" -d '{"name":"f2f-scas-worker","platform":"node"}' >/dev/null
DSN="$(curl -sS "${H[@]}" "$API/projects/personal/f2f-scas-worker/keys/" | jq -r '.[0].dsn.public')"
infisical secrets set --env=prod --path=/scas-worker SENTRY_DSN="$DSN" >/dev/null
unset DSN
```
Add `CDSE_CLIENT_ID` and `CDSE_CLIENT_SECRET` from the CDSE dashboard (User Settings → OAuth clients → Create) the same way. Expected: `infisical secrets --env=prod --path=/scas-worker` lists the names (do not paste values anywhere).

- [ ] **Step 4: Create the Railway service and bucket**

In the F2F Railway project ("Yesset's projects" workspace):
1. Create a bucket named `f2f-evidence`.
2. Create service `scas-worker` from the GitHub repo `bonkboykz/field-to-finance` (root directory: repository root). Generate a Railway domain.
3. Set variables:
```bash
railway link   # choose the F2F project, production environment
railway variables --service scas-worker \
  --set "RAILWAY_DOCKERFILE_PATH=apps/scas-worker/Dockerfile" \
  --set "SOLANA_RPC_URL=https://api.devnet.solana.com" \
  --set "SOLANA_CLUSTER=devnet" \
  --set "F2F_PROGRAM_ID=9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm" \
  --set 'BUCKET_NAME=${{f2f-evidence.BUCKET}}' \
  --set 'BUCKET_ENDPOINT=${{f2f-evidence.ENDPOINT}}' \
  --set 'BUCKET_REGION=${{f2f-evidence.REGION}}' \
  --set 'BUCKET_ACCESS_KEY_ID=${{f2f-evidence.ACCESS_KEY_ID}}' \
  --set 'BUCKET_SECRET_ACCESS_KEY=${{f2f-evidence.SECRET_ACCESS_KEY}}' \
  --set "BUCKET_FORCE_PATH_STYLE=false" \
  --set 'EVIDENCE_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}' \
  --set "SENTRY_ENVIRONMENT=production"
```
4. In Infisical, add a Secret Sync from project `field-to-finance`, env `prod`, path `/scas-worker` to Railway service `scas-worker` (Integrations → Secret Syncs → Railway). It pushes `CDSE_*`, `SCAS_SECRET_KEY`, `WORKER_API_TOKEN`, `SENTRY_DSN`.
5. Service Settings → Deploy → Healthcheck Path: `/health`.

Expected: the deploy turns healthy; `curl -s https://<domain>/health` returns `ok: true` with the SCAS pubkey.

Railway notes: `railway.json`/`railway.toml` (Config as Code) is deprecated and stops working for legacy services on 2026-12-01; new configuration belongs in `.railway/railway.ts` (Infrastructure as Code). This plan configures the one service through variables and settings and leaves the IaC file to the web-app deploy, where both services can be declared together.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker/Dockerfile .dockerignore
git commit -m "build(scas): Docker image for Railway"
```

---

### Task 14: Live smoke run and a real recorded fixture

**Files:**
- Create: `apps/scas-worker/test/fixtures/stats-real-pilot.json` (recorded), `apps/scas-worker/test/real-fixture.test.ts`
- Pilot polygons stay outside git until the team confirms they may be public: keep them in `~/f2f-private/pilot-*.geojson`.

**Interfaces:**
- Consumes: `scas stats`, `scas polygon put`, `scas attest`, `parseStats`.
- Produces: confirmation that the request shape, axis order, masks and counts work against the real API; a regression fixture recorded from it.

- [ ] **Step 1: Record a real response for a pilot field**

Run:
```bash
cd apps/scas-worker
infisical run --env=dev --path=/scas-worker -- pnpm scas stats ~/f2f-private/pilot-1.geojson --to 2026-09-30 --days 30 \
  > test/fixtures/stats-real-pilot.json
jq '.data | length, (map(select(.outputs.footprint.bands.B0.stats.noDataCount < .outputs.footprint.bands.B0.stats.sampleCount)) | length)' \
  test/fixtures/stats-real-pilot.json
```
Expected: about 30 intervals, of which several have footprint pixels (Sentinel-2A/2B/2C revisit is 2–5 days at 52°N). If every interval has `noDataCount == sampleCount`, the geometry was read in the wrong axis order: change `CRS_WGS84` in `src/sentinel/request.ts` to `http://www.opengis.net/def/crs/OGC/1.3/CRS84`, update its test expectation, and record again. The response contains statistics only, not the polygon.

- [ ] **Step 2: Write the regression test against the recorded response**

`apps/scas-worker/test/real-fixture.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseStats } from "../src/sentinel/parse";
import real from "./fixtures/stats-real-pilot.json";

describe("recorded Statistical API response (pilot field, September 2026)", () => {
  it("parses into observations with plausible counts and NDVI", () => {
    const parsed = parseStats(real);
    expect(parsed.observations.length).toBeGreaterThan(0);
    expect(parsed.polygonPixels).toBeGreaterThan(0);
    for (const o of parsed.observations) {
      expect(o.clearRatio).toBeGreaterThanOrEqual(0);
      expect(o.clearRatio).toBeLessThanOrEqual(1);
      if (o.ndviMean !== null) {
        expect(o.ndviMean).toBeGreaterThanOrEqual(-1);
        expect(o.ndviMean).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

Run: `pnpm -C apps/scas-worker exec vitest run test/real-fixture.test.ts`
Expected: PASS.

- [ ] **Step 3: Dry-run the full path against devnet**

Prerequisite: the program is deployed to devnet, `init_config` set `scas` to the SCAS pubkey, and the pilot Farm Project and Field exist with `polygon_hash = polygonHash(pilot-1.geojson)` from `@f2f/sdk` and `area_ha_x100` from the cadastral area.

Run:
```bash
infisical run --env=dev --path=/scas-worker -- pnpm scas polygon put ~/f2f-private/pilot-1.geojson
infisical run --env=dev --path=/scas-worker -- pnpm scas attest --project <PROJECT_PDA> --field 0 --kind FieldVerified --dry-run
infisical run --env=dev --path=/scas-worker -- pnpm scas attest --project <PROJECT_PDA> --field 0 --kind Vegetation --replay-date 2026-07-12 --dry-run
```
Expected: the polygon hash printed by `polygon put` equals the Field's on-chain hash; both dry runs print a verdict, reasons and an evidence hash. Note the CDSE dashboard PU usage after the runs and record it in the devlog (budget: 10 000 PU/month).

- [ ] **Step 4: Sign one real Attestation**

Run: `infisical run --env=dev --path=/scas-worker -- pnpm scas attest --project <PROJECT_PDA> --field 0 --kind FieldVerified`
Expected: JSON with `signature`, `attestation`, `evidenceUri`. `solana confirm -v <signature> --url devnet` shows the program log; opening `evidenceUri` returns the evidence JSON whose sha256 equals `evidenceHash`.

- [ ] **Step 5: Commit**

```bash
git add apps/scas-worker/test/fixtures/stats-real-pilot.json apps/scas-worker/test/real-fixture.test.ts apps/scas-worker/src/sentinel/request.ts apps/scas-worker/test/sentinel-request.test.ts
git commit -m "test(scas): recorded Statistical API response from a pilot field"
```

---

### Task 15: System doc, flow doc, index and devlog

**Files:**
- Create: `docs/systems/scas.md`, `docs/flows/field-verification.md`
- Modify: `docs/README.md`, `docs/glossary.md`, `docs/systems/program.md`, `docs/devlog/<today>.md`

- [ ] **Step 1: Write `docs/systems/scas.md`**

```markdown
# SCAS worker

## Purpose

The SCAS worker turns Sentinel-2 observations of a Field into signed Attestations on Solana. It is the only holder of the SCAS key ([ADR 0008](../architecture/decisions/0008-scas-sentinel2-signed-attestations.md)) and runs as a TypeScript service on Railway ([ADR 0009](../architecture/decisions/0009-worker-language.md), [ADR 0010](../architecture/decisions/0010-deploy-on-railway.md)).

## Questions this doc answers

- How does a verdict get computed, and from which data?
- What exactly is hashed into `polygon_hash` and `evidence_hash`?
- Where is evidence stored and how is it served?
- What happens when the satellite API fails or clouds hide the field?
- How is the 2027 season demonstrated before it happens?

## Scope

Polygon storage and validation, Statistical API requests, verdict rules, evidence documents, the evidence proxy, and sending `record_attestation`. CLI and HTTP entry points.

## Non-scope

- Registering Fields: the Producer signs `register_field` from the web app.
- Deciding which Fields go into a Pool: the Issuer does that; the Program checks the verified flag.
- Raster processing: the Statistical API returns statistics, the worker never downloads imagery.

## Key concepts

Attestation, Field, Farm Project, NDVI, SCAS (see the [glossary](../glossary.md)). Also:

- **Observation**: one acquisition day with the share of clear polygon pixels and the mean NDVI over them.
- **Clear scene**: an observation where at least 70% of the polygon's pixels are clear (spec: more than 30% cloud cover is skipped).
- **Evidence**: the JSON document behind an Attestation; see below.
- **Replay**: a season Attestation computed as of a past date; `replay: true` in the evidence.

## How the system works

1. The orchestrator `runAttestation` reads the FarmProject (crop, season) and the Field (polygon hash, declared area, attestation count) from the Program.
2. It loads the polygon: from the request, or from the bucket at `polygons/<polygon_hash>.json`. The polygon's hash must equal the Field's on-chain hash.
3. It validates the geometry (no self-intersection, lon/lat bounds, at most 20 000 ha) and computes the geodesic area with `@turf/area`.
4. For a valid polygon it calls the Statistical API once: Sentinel-2 L2A, daily intervals (`P1D`) over the rule's window, about 10 m pixels, tile prefilter `maxCloudCoverage: 80`. The evalscript computes NDVI and masks SCL classes 0, 1, 3, 8, 9, 10, 11. Two outputs with separate masks give the polygon's pixels with data (`footprint`) and its clear pixels (`ndvi`).
5. The parser turns intervals into Observations. Days without acquisition are dropped. The polygon pixel count is the largest daily footprint in the window.
6. The rules (version `f2f-scas-rules/1`) produce `Pass`, `Fail` or `InsufficientData` with reasons.
7. The evidence document is serialized as canonical JSON and hashed with SHA-256. It is written to `evidence/<hash>.json`, then `record_attestation` is sent with the hash, the URI `<EVIDENCE_BASE_URL>/e/<hash>`, the latest clear NDVI × 10 000 and the scene day as Unix seconds (both 0 when there is no clear scene).

### Verdict rules

| Kind | Window | Pass | Fail | InsufficientData |
| --- | --- | --- | --- | --- |
| FieldVerified | 90 days to today | valid polygon, area within 5% of declared, ≥1 clear scene | invalid polygon, or area off by more than 5% | no clear scene |
| Sowing | 30 days | latest clear NDVI in the crop's sowing band | outside the band | no clear scene |
| Vegetation | 20 days | latest clear NDVI in the crop's range for the month | outside the range | no clear scene |
| Harvest | 120 days | season peak ≥ minimum, latest ≤ post-harvest maximum, latest after peak | otherwise | fewer than 2 clear scenes |

Season kinds outside the crop's months, or for a crop without a calendar, are refused before any API call.

Crop calendar (**demo assumption**, spring wheat in northern Kazakhstan, not calibrated): sowing in May–June with NDVI 0.05–0.40; vegetation June 0.20–0.65, July 0.45–0.90, August 0.30–0.80; harvest in August–September with a peak of at least 0.50 and a latest value of at most 0.35. Source: `apps/scas-worker/src/rules/crops.ts`.

### Polygon hash

`polygon_hash = sha256(canonical_json(normalize(geojson)))`, implemented once in `packages/sdk/src/polygon.ts` and used by both the web app and the worker. Normalization unwraps a Feature or a one-feature FeatureCollection, keeps only `type` and `coordinates`, drops altitude, rounds to 7 decimals and closes open rings. Canonical JSON sorts keys and has no whitespace.

### Evidence document

Schema `f2f-scas-evidence/1`: rule version, replay flag, generation time, cluster and program id, subject (project, field, index, crop, season, declared area, polygon hash), kind, as-of day, window, the polygon, the geometry check, the exact Statistical API request, the raw response, the parsed scenes, failed intervals, the decision and the on-chain values, and the signer. The request never contains credentials.

## Important flows

- [Field verification](../flows/field-verification.md): from polygon upload to the first `FieldVerified` Attestation.
- [Pool lifecycle](../flows/pool-lifecycle.md): where Attestations fit in the whole deal.

## Data and state

- No database. Program accounts are the state.
- Bucket `f2f-evidence` (Railway, private, S3-compatible): `polygons/<sha256>.json` and `evidence/<sha256>.json`. Keys are content hashes, so writes are idempotent and objects never change.
- In memory: the CDSE access token until 60 s before it expires; a queue that serializes sends.

## Interfaces and entry points

- CLI: `scas attest --project <pubkey> --field <index> --kind <kind> [--replay-date YYYY-MM-DD] [--polygon <file>] [--dry-run]`, `scas polygon put <file>`, `scas stats <file> --to YYYY-MM-DD [--days N]`, `scas serve`.
- HTTP: `GET /health`; `POST /attest` and `POST /polygons` with `Authorization: Bearer <WORKER_API_TOKEN>`; `GET /e/<hash>` serves evidence publicly after checking its hash.

## Dependencies

- CDSE identity (`https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`) and Statistical API (`https://sh.dataspace.copernicus.eu/statistics/v1`). Free tier: 10 000 requests and 10 000 processing units per month, 300 of each per minute.
- Solana devnet RPC and the `f2f` Program.
- Railway bucket; GlitchTip (org `personal`); Infisical (org `personal`) for secrets.

## Downstream effects

- The web app reads Attestations and links `evidence_uri`; it must use `@f2f/sdk` `polygonHash` when registering Fields and upload the polygon with `POST /polygons`.
- Changing normalization, canonical JSON or the evidence schema changes hashes. Bump `RULES_VERSION` or `EVIDENCE_SCHEMA` instead of silently changing behavior.

## Invariants and assumptions

- No transaction is sent after a failed or unparseable Statistical API response.
- Evidence is stored before the transaction, so every on-chain URI resolves.
- The SCAS key equals `Config.scas`; it is checked before the first non-dry-run attestation.
- `evidence_uri` is at most 128 bytes; `EVIDENCE_BASE_URL` is at most 61 characters.
- Time windows are whole UTC days.

## Error handling

- Statistical API: 429, 5xx, 401 and network errors are retried up to 4 attempts with 0.5 s, 1 s, 2 s backoff or `Retry-After`; other errors fail at once. HTTP callers get 502.
- Clouds or no acquisitions: `InsufficientData` is signed, it is a valid answer.
- Wrong polygon (hash mismatch): 409; missing polygon: 404; season kind out of calendar: 422.
- Unexpected errors: 500 and a GlitchTip event.

## Security and privacy notes

- The SCAS key and CDSE credentials live only in Infisical and Railway variables.
- `WORKER_API_TOKEN` gates the endpoints that sign or write; it is compared in constant time.
- Evidence and polygons are public through `/e/` and the Program; they hold field boundaries but no personal data. Confirm with the pilot farmers before using real contours in a public demo.

## Observability and debugging

- `GET /health` shows the SCAS pubkey and the deployed commit.
- `scas attest ... --dry-run` prints the full decision without storing or signing.
- `scas stats` prints the raw API response for a polygon.
- GlitchTip project `f2f-scas-worker`; Railway logs.

## Testing notes

`pnpm nx test scas-worker` runs offline: fixtures for clear, cloudy, empty, partially failed and harvest responses, one recorded real response, retry and no-signing tests, HTTP and CLI tests. `pnpm nx test sdk` covers hashing and PDAs.

## Common pitfalls

- `sampleCount` counts the polygon's bounding box, not the polygon; never divide by it.
- `@anchor-lang/core` is CommonJS: import `BN` from `bn.js`.
- Railway buckets are private; a presigned URL is too long for the on-chain URI, hence the `/e/` proxy.
- `Date.parse("2026-02-30")` is not NaN; replay dates are round-trip checked.

## Source map

- [apps/scas-worker/src/attest.ts](../../apps/scas-worker/src/attest.ts)
- [apps/scas-worker/src/rules/verdict.ts](../../apps/scas-worker/src/rules/verdict.ts), [crops.ts](../../apps/scas-worker/src/rules/crops.ts)
- [apps/scas-worker/src/sentinel/](../../apps/scas-worker/src/sentinel/)
- [apps/scas-worker/src/evidence.ts](../../apps/scas-worker/src/evidence.ts), [store.ts](../../apps/scas-worker/src/store.ts)
- [apps/scas-worker/src/chain.ts](../../apps/scas-worker/src/chain.ts)
- [apps/scas-worker/src/http.ts](../../apps/scas-worker/src/http.ts), [cli.ts](../../apps/scas-worker/src/cli.ts)
- [packages/sdk/src/polygon.ts](../../packages/sdk/src/polygon.ts), [pda.ts](../../packages/sdk/src/pda.ts)

## Related docs

- [Program](program.md)
- [Field verification](../flows/field-verification.md)
- [MVP design, section 4.4](../specs/2026-10-03-mvp-design.md)
- [CDSE Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html)
```

- [ ] **Step 2: Write `docs/flows/field-verification.md`**

```markdown
# Field verification

## Purpose

Turn a Producer's field boundary into a verified Field on-chain, so the Field's Farm Project can join a Pool. `add_project` rejects a project with any unverified Field.

## Trigger

The admin view (or the demo script) asks SCAS to verify a registered Field: `POST /attest` with `kind: "FieldVerified"`, or `scas attest --kind FieldVerified`.

## Participants

Producer, web app, SCAS worker, CDSE Statistical API, Railway bucket, the [Program](../systems/program.md).

## Step-by-step flow

1. The Producer uploads the field's GeoJSON in the farmer view. The web app sends it to `POST /polygons`; the worker validates it, stores `polygons/<hash>.json` and returns the polygon hash and computed area.
2. The Producer signs `register_field(polygon_hash, area_ha_x100)`. The declared area comes from the cadastral record, not from the computed area.
3. The admin view calls `POST /attest { project, fieldIndex, kind: "FieldVerified" }`.
4. The worker reads the Field, loads the stored polygon, checks its hash against `polygon_hash`, validates it and computes its area.
5. The worker requests daily NDVI statistics for the last 90 days and keeps observations with at least 70% clear pixels.
6. Verdict: `Pass` if the polygon is valid, its area is within 5% of the declared area and a clear scene exists; `Fail` for an invalid polygon or an area mismatch; `InsufficientData` when clouds or missing acquisitions leave no clear scene.
7. The worker writes the evidence to `evidence/<sha256>.json` and sends `record_attestation(FieldVerified, verdict, hash, uri, ndvi, scene_date)`.
8. A `Pass` sets `Field.verified` and increments the project's verified count, once per Field.

## Data and state changes

- Bucket: one polygon object, one evidence object per attempt.
- Program: a new Attestation at `["attestation", field, sequence]`; `Field.attestation_count` + 1; on the first `Pass`, `Field.verified = true`.

## Success behavior

The admin view shows the verdict, NDVI, scene date, the explorer link of the transaction and the evidence link. The Field page lists the Attestation.

## Failure behavior

- Satellite API down: the worker retries up to 4 times, then returns 502 and signs nothing. Retry later.
- `InsufficientData` or `Fail`: an Attestation is still recorded, the Field stays unverified. Run again after a clear day or fix the polygon or declared area (a new Field is needed, since registered Fields cannot change).
- Polygon not uploaded: 404. Hash mismatch: 409, the uploaded file is not the one that was registered.

## External dependencies

CDSE account with an OAuth client, Solana devnet RPC, Railway bucket, the SCAS key in Infisical.

## Invariants and assumptions

- Nothing is signed after a failed satellite request.
- Evidence exists in the bucket before its URI goes on-chain.
- `FieldVerified` always uses current imagery, never a replay date.

## Security and privacy notes

`POST /polygons` and `POST /attest` need the worker token, which only the web server holds. Field boundaries become public through evidence.

## Observability and debugging

`scas attest ... --dry-run` shows the decision without signing. The evidence JSON shows every scene and the reasons. GlitchTip project `f2f-scas-worker`.

## Testing notes

`apps/scas-worker/test/attest.test.ts` covers clear, cloudy, empty, area mismatch, invalid polygon, API failure and retry, hash mismatch and dry run.

## Source map

- [apps/scas-worker/src/attest.ts](../../apps/scas-worker/src/attest.ts)
- [apps/scas-worker/src/polygons.ts](../../apps/scas-worker/src/polygons.ts)
- [anchor/programs/f2f/src/instructions/record_attestation.rs](../../anchor/programs/f2f/src/instructions/record_attestation.rs)

## Related docs

- [SCAS worker](../systems/scas.md)
- [Pool lifecycle](pool-lifecycle.md)
```

- [ ] **Step 3: Update the index, glossary, program doc and devlog**

In `docs/README.md`, replace the line `` - `scas.md` — field verification worker and satellite data pipeline. `` with:
```markdown
- [scas.md](systems/scas.md) — field verification worker and satellite data pipeline.
```
Move the `field-verification.md` line from "Planned flows" to the flow list as:
```markdown
- [field-verification.md](flows/field-verification.md) — from polygon upload to the first signed attestation.
```
Add under "Plans":
```markdown
- [SCAS worker, 2026-10-03](plans/2026-10-03-scas-worker.md)
```

In `docs/glossary.md`, add after "Exchange":
```markdown
## Evidence

The JSON document behind an Attestation: the field polygon, the satellite request and response, the scenes used, the rule version and the verdict. Stored off-chain under its SHA-256 hash; the hash and a URI are recorded on Solana.
```
and after "Registrar":
```markdown
## Replay

A season Attestation computed as of a past date, used in the demo because the 2027 season has not started. Its evidence carries `replay: true`.
```

In `docs/systems/program.md`, under "Invariants and assumptions" add:
```markdown
- `Field.polygon_hash` is defined by `polygonHash` in `packages/sdk`; see [SCAS worker](scas.md#polygon-hash).
```

Create or extend the devlog for the day of the work, for example `docs/devlog/2026-10-05.md`:
```markdown
# 2026-10-05

- Built the SCAS worker: CDSE Statistical API client with retries, verdict rules (FieldVerified, Sowing, Vegetation, Harvest), content-addressed evidence in the Railway bucket, record_attestation sender, CLI and HTTP endpoint.
- Added packages/sdk with the polygon hash, PDA helpers and the committed IDL.
- Recorded a real Statistical API response for a pilot field; PU used: <number from the CDSE dashboard>.
```
Replace `<number from the CDSE dashboard>` with the figure noted in Task 14 Step 3 before committing.

- [ ] **Step 4: Check links and commit**

Run: `grep -o '\](\.\./[^)]*)' docs/systems/scas.md docs/flows/field-verification.md | sort -u`
Expected: every listed path exists (`ls` each if unsure).

```bash
git add docs
git commit -m "docs: SCAS worker system doc and field verification flow"
git push
```

---

## Self-review notes

- Spec 4.4 coverage: data source (Tasks 5–6), cloud handling and InsufficientData (Tasks 5, 7, 10), evidence and bucket (Task 8, 10, 11), FieldVerified and Vegetation rules (Task 7), CLI and HTTP (Tasks 11–12), season replay (Tasks 7, 10). Spec 6: retries and no signing on failure (Tasks 6, 10), GlitchTip (Task 12). Spec 7: recorded responses for clear, cloudy, no scenes, area mismatch (Tasks 5, 10, 14).
- Sowing and Harvest rules are not in the spec; Task 7 defines them as demo rules under `f2f-scas-rules/1` and the system doc says so.
- Type names checked across tasks: `Observation`, `ParsedStats`, `StatsRequest`, `TimeWindow`, `GeometryCheck`, `Decision`, `EvidenceDoc`, `BlobStore`, `Chain`, `AttestationArgs`, `AttestRequest`, `AttestResult`, `PolygonUpload`, `HttpDeps`, `CliRuntime`.
