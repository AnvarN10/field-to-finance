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
