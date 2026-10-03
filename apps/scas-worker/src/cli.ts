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
