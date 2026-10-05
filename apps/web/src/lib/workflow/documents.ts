import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { documents, type DocumentKind, type DocumentRow, type DocumentStatus } from "../db/schema";

/** The term sheet's farmer requirements (ADR 0014), one document each, per application. */
export const REQUIRED_KINDS = ["insurance", "land_act", "financials", "encumbrance", "yields", "imagery"] as const satisfies readonly DocumentKind[];
export type RequiredKind = (typeof REQUIRED_KINDS)[number];

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  insurance: "Crop insurance",
  land_act: "Land-use right: state act and cadastral numbers",
  financials: "Financial statements: 4 forms, payables incl. loans",
  encumbrance: "Encumbrance certificate",
  yields: "Historical field yields",
  imagery: "Field imagery",
  kyc: "Issuer KYC: charter and director ID",
  other: "Other document",
};

export interface ChecklistRow {
  kind: RequiredKind;
  label: string;
  status: "missing" | DocumentStatus;
  documentId: string | null;
  sha256: string | null;
  note: string | null;
}

/** Current (not replaced) documents of an application, oldest first. */
export const currentDocuments = (db: Db, applicationId: string): Promise<DocumentRow[]> =>
  db.select().from(documents).where(and(eq(documents.applicationId, applicationId), isNull(documents.replacedAt))).orderBy(asc(documents.createdAt));

export async function checklist(db: Db, applicationId: string): Promise<ChecklistRow[]> {
  const docs = await currentDocuments(db, applicationId);
  return REQUIRED_KINDS.map((kind) => {
    const d = docs.find((x) => x.kind === kind);
    return { kind, label: DOCUMENT_LABELS[kind], status: d?.status ?? "missing", documentId: d?.id ?? null, sha256: d?.sha256 ?? null, note: d?.reviewNote ?? null };
  });
}
