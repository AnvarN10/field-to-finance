/** One CSV cell: formula prefixes are neutralized (spreadsheet injection), commas, quotes and newlines are quoted. */
export function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
