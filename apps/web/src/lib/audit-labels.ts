import { STATUS_INFO, type ApplicationStatus } from "./application-status";
import type { DocumentKind } from "./db/schema";
import { shortKey } from "./format";
import { DOCUMENT_LABELS } from "./workflow/documents";

/** Sentence-case labels for audit action codes; the code stays in the database for queries. */
const ACTIONS: Record<string, string> = {
  "application.create": "Created the application",
  "application.submit": "Submitted the application",
  "application.advance": "Moved the application",
  "application.reject": "Rejected the application",
  "application.withdraw": "Withdrew the application",
  "application.attach_project": "Linked the farm project",
  "application.chain_status": "Status updated from the chain",
  "document.upload": "Uploaded a document",
  "document.accept": "Accepted a document",
  "document.reject": "Rejected a document",
  "farmer_kyc.submit": "Submitted issuer KYC",
  "farmer_kyc.approve": "Approved issuer KYC",
  "farmer_kyc.reject": "Rejected issuer KYC",
  "investor_kyc.submit": "Submitted investor KYC",
  "investor_kyc.approve": "Approved investor KYC",
  "investor_kyc.approve_wallet": "Approved KYC for a linked wallet",
  "investor_kyc.reject": "Rejected investor KYC",
  "investor_kyc.revoke": "Revoked investor KYC",
  "kfd.accept": "Accepted the key features document",
  "wallet.link": "Linked a wallet",
  "fields.verify": "Verified the fields",
  "fields.verify_all": "Verified all fields",
  "pool.create": "Created the pool",
  "pool.add_project": "Added the project to the pool",
  "pool.open": "Opened the pool",
  "pool.close_subscription": "Closed the subscription",
  "pool.disburse": "Disbursed the proceeds",
  "role.choose": "Chose a cabinet",
  "role.grant": "Granted a role",
  "role.revoke": "Removed a role",
  "treasury.mint_test_usdc": "Minted test USDC",
  faucet: "Sent test USDC",
  "tx.subscribe": "Subscribed",
  "tx.refund": "Refunded",
  "tx.redeem": "Redeemed",
  "tx.redeem-delivery": "Claimed grain delivery",
  "tx.register-project": "Registered the farm project",
};

/** A code without a label still reads as words: `pool.set_rule` becomes "Pool set rule". */
export function actionLabel(code: string): string {
  const known = ACTIONS[code];
  if (known) return known;
  const words = code.replace(/[._-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
}

const ROLE_NAMES: Record<string, string> = { farmer: "Farmer", investor: "Investor", arranger: "Arranger" };
const docLabel = (k: string) => (DOCUMENT_LABELS[k as DocumentKind] ?? k).split(":")[0] as string;
const statusLabel = (s: string) => STATUS_INFO[s as ApplicationStatus]?.label ?? s;
const value = (v: string) => (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v) ? shortKey(v) : v.length > 80 ? `${v.slice(0, 80)}…` : v);

/** The audit payload as a short sentence-case line, e.g. "Land-use right · Note: page 2 is missing". */
export function auditDetail(p: Record<string, unknown>): string {
  const s = (k: string) => (p[k] === undefined || p[k] === null ? null : String(p[k]));
  const parts: string[] = [];
  if (s("kind")) parts.push(docLabel(s("kind") as string));
  if (s("from") && s("to")) parts.push(`${statusLabel(s("from") as string)} to ${statusLabel(s("to") as string)}`);
  else if (s("to")) parts.push(`To ${statusLabel(s("to") as string)}`);
  if (s("role")) parts.push(ROLE_NAMES[s("role") as string] ?? (s("role") as string));
  const labelled: [string, string][] = [
    ["poolId", "Pool"],
    ["pool", "Pool"],
    ["symbol", "Symbol"],
    ["project", "Project"],
    ["wallet", "Wallet"],
    ["category", "Category"],
    ["election", "Election"],
    ["rule", "Rule"],
    ["usd", "USD"],
    ["amount", "Amount"],
    ["note", "Note"],
    ["reason", "Reason"],
    ["message", "Result"],
  ];
  for (const [k, label] of labelled) {
    const v = s(k);
    if (v) parts.push(`${label}: ${value(v)}`);
  }
  return parts.join(" · ");
}
