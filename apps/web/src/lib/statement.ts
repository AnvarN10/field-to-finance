import { toCsv } from "./csv";

export type StatementRow = { date: string; type: string; pool: string; amountUsd: string; tokens: string; signature: string };

const HEADER = ["Date", "Type", "Pool", "Amount (USD)", "Tokens", "Transaction"];

export function statementCsv(rows: StatementRow[]): string {
  return toCsv(HEADER, rows.map((r) => [r.date, r.type, r.pool, r.amountUsd, r.tokens, r.signature]));
}
