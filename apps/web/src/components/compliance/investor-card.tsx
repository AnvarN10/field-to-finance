import type { ReactNode } from "react";
import { shortKey } from "../../lib/format";
import type { InvestorQueueRow } from "../../lib/workflow/arranger";
import { RETAIL_LIMITS } from "../../lib/workflow/investor";
import { KycStatusBadge } from "../cabinet/badges";

const NET: Record<string, string> = { "under-100k": "Under USD 100,000", "100k-1m": "USD 100,000 to 1M", "1m-10m": "USD 1M to 10M", "over-10m": "Over USD 10M" };
const EXPERIENCE: Record<string, string> = { none: "None", some: "Some", extensive: "Extensive" };
const CATEGORY: Record<string, string> = { professional: "Professional", retail: "Retail", institutional: "Institutional" };

/** One investor's categorization answers and mock KYC, for compliance (decisions) and the arranger (read view). */
export function InvestorCard({ r, children }: { r: InvestorQueueRow; children?: ReactNode }) {
  const q = r.profile.questionnaire as { answers?: { netAssets?: string; experience?: string; basis?: string }; kyc?: { fullName?: string; country?: string; iin?: string } };
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium break-all">{r.email}</span>
        <KycStatusBadge status={r.profile.kycStatus} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ["Category", r.profile.category ? CATEGORY[r.profile.category] : "Not answered"],
          ["Net assets", NET[q.answers?.netAssets ?? ""] ?? "Not answered"],
          ["Experience", EXPERIENCE[q.answers?.experience ?? ""] ?? q.answers?.experience ?? "Not answered"],
          ["Why they qualify", q.answers?.basis ?? "Not given"],
          ["Full name", q.kyc?.fullName ?? "Not given"],
          ["Country", q.kyc?.country ?? "Not given"],
          ["IIN", q.kyc?.iin ?? "Not given"],
          ["Risk acknowledgement", r.profile.riskAckAt ? "Given" : "Not yet"],
          ["Wallets", r.wallets.length ? r.wallets.map(shortKey).join(", ") : "None linked yet: approval applies when one is linked"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className={k === "IIN" && q.kyc?.iin ? "tabular break-words" : "break-words"}>{v}</dd>
          </div>
        ))}
      </dl>
      {r.profile.category === "retail" ? <p className="rounded-md border border-border p-3 text-sm">{RETAIL_LIMITS}</p> : null}
      {r.profile.kycNote ? <p className="text-sm text-muted-foreground">{`Note: ${r.profile.kycNote}`}</p> : null}
      {children}
    </li>
  );
}
