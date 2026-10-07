/** A same-origin path to return to after sign-in, or null. Rejects protocol-relative and backslash tricks. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.length > 512) return null;
  // Never back into sign-in itself (a redirect loop), an invitation link or an API route.
  if (/^\/(sign-in|invite)(?:[/?#]|$)|^\/api(?:[/?#]|$)/.test(next)) return null;
  return next;
}
