export type StatementRow = { date: string; type: string; pool: string; amountUsd: string; tokens: string; signature: string };

const HEADER = ["Date", "Type", "Pool", "Amount (USD)", "Tokens", "Transaction"];

/** One CSV cell: formula prefixes are neutralized (spreadsheet injection), commas, quotes and newlines are quoted. */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function statementCsv(rows: StatementRow[]): string {
  const lines = [HEADER, ...rows.map((r) => [r.date, r.type, r.pool, r.amountUsd, r.tokens, r.signature])];
  return lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}
