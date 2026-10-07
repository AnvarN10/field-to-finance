import { reviewDocumentAction } from "../../app/console/_actions/applications";
import type { ChecklistRow } from "../../lib/workflow/documents";
import { DocumentStatusBadge } from "../cabinet/badges";
import { textLink } from "../cabinet/section";
import { Decision } from "./decision";

/** Term-sheet documents of an application, each with its file and an accept/reject decision while review is open. */
export function DocumentReview({ rows, reviewOpen }: { rows: ChecklistRow[]; reviewOpen: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((r) => (
        <li key={r.kind} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{r.label}</span>
            <DocumentStatusBadge status={r.status} />
          </div>
          {r.sha256 ? (
            <a href={`/api/documents/${r.sha256}`} className={`${textLink} self-start text-sm`}>
              {`Download ${r.label}`}
            </a>
          ) : null}
          {r.note ? <p className="text-sm text-muted-foreground">{`Note: ${r.note}`}</p> : null}
          {reviewOpen && r.status === "pending" && r.documentId ? (
            <Decision approveLabel="Accept" approve={reviewDocumentAction.bind(null, r.documentId, "accepted", null)} reject={reviewDocumentAction.bind(null, r.documentId, "rejected")} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
