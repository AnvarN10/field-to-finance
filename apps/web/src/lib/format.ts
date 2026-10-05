export const USDC_DECIMALS = 6;
const SCALE = 1_000_000n;

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Integer USDC base units to "$1,234.56". Rounds half up. Never uses floats. */
export function formatUsd(baseUnits: bigint | string, opts: { cents?: boolean } = {}): string {
  const v = BigInt(baseUnits);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  let dollars = abs / SCALE;
  const micros = abs % SCALE;
  const sign = neg ? "-" : "";
  if (opts.cents === false) {
    if (micros >= SCALE / 2n) dollars += 1n;
    return `${sign}$${group(dollars.toString())}`;
  }
  let cents = (micros + 5_000n) / 10_000n;
  if (cents === 100n) {
    dollars += 1n;
    cents = 0n;
  }
  return `${sign}$${group(dollars.toString())}.${cents.toString().padStart(2, "0")}`;
}

/** "1,000.50" or "$250" to base units. At most 6 decimals; no negatives or exponents. */
export function parseUsd(input: string): bigint {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(s)) {
    throw new RangeError("Enter an amount in dollars, for example 250 or 250.50");
  }
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole as string) * SCALE + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

/** Mirrors math::with_yield in the program: floor(amount × (10 000 + bps) / 10 000). */
export function withYield(amount: bigint, yieldBps: number): bigint {
  return (amount * (10_000n + BigInt(yieldBps))) / 10_000n;
}

export const formatYield = (bps: number) => `${(bps / 100).toFixed(1)}%`;

export function formatTonnes(kg: bigint | string): string {
  const t = Number(BigInt(kg)) / 1000;
  return `${t.toLocaleString("en-US", { maximumFractionDigits: 1 })} t`;
}

export const formatHa = (areaHaX100: number) => `${(areaHaX100 / 100).toFixed(2)} ha`;

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
export const formatDateUtc = (unixSeconds: number) => `${dateFmt.format(new Date(unixSeconds * 1000))} UTC`;

const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relativeTime(unixSeconds: number, nowMs: number = Date.now()): string {
  const diff = unixSeconds - Math.floor(nowMs / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return rel.format(diff, "second");
  if (abs < 3600) return rel.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rel.format(Math.round(diff / 3600), "hour");
  return rel.format(Math.round(diff / 86_400), "day");
}

function clusterQuery(cluster: string): string {
  if (cluster === "localnet") return `cluster=custom&customUrl=${encodeURIComponent("http://127.0.0.1:8899")}`;
  return `cluster=${cluster}`;
}

export const explorerTx = (sig: string, cluster = "devnet") => `https://explorer.solana.com/tx/${sig}?${clusterQuery(cluster)}`;
export const explorerAddress = (addr: string, cluster = "devnet") =>
  `https://explorer.solana.com/address/${addr}?${clusterQuery(cluster)}`;

export const shortKey = (key: string) => (key.length <= 12 ? key : `${key.slice(0, 4)}…${key.slice(-4)}`);

/** Like formatUsd but floors to the cent: for payouts the program floors in base units. */
export function formatUsdDown(baseUnits: bigint | string): string {
  const v = BigInt(baseUnits);
  return formatUsd(v - (v % 10_000n));
}

/** "1 field", "2 fields": count and noun with the English plural (regular nouns only). */
export const plural = (n: number, noun: string, many = `${noun}s`) => `${n} ${n === 1 ? noun : many}`;
