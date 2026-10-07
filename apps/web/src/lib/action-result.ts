import type { ExplainedError } from "./chain/explain";

/** What a console server action returns to the page: a message and signatures, or an explained error. */
export type ActionResult = { ok: true; message: string; signatures: string[] } | { ok: false; error: ExplainedError; logs: string[] };
