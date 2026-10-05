/** Splits a workflow validation message ("bin: BIN is 12 digits; region: enter the region") into per-field messages. */
export function fieldErrors(message: string): { fields: Record<string, string>; rest: string | null } {
  const fields: Record<string, string> = {};
  const rest: string[] = [];
  for (const part of message.split("; ")) {
    const m = /^([A-Za-z][\w.]*): (.+)$/.exec(part);
    if (m && m[1] && m[2]) fields[m[1].split(".").pop() as string] = m[2];
    else rest.push(part);
  }
  return { fields, rest: rest.length ? rest.join("; ") : null };
}
