/** A same-origin path to return to after sign-in, or null. Rejects protocol-relative and backslash tricks. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.length > 512) return null;
  return next;
}
