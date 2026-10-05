"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChecklistRow } from "../../lib/workflow/documents";
import { DocumentStatusBadge } from "../cabinet/badges";

export type UploadResult = { ok: true } | { ok: false; error: string };

/** Per-document status from the term sheet's checklist. `editable`: which rows accept an upload right now. */
export function DocumentChecklist({
  rows,
  editable,
  upload,
}: {
  rows: ChecklistRow[];
  editable: "all" | "rejected-only" | "none";
  upload: (kind: ChecklistRow["kind"], form: FormData) => Promise<UploadResult>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canUpload = (r: ChecklistRow) => editable === "all" || (editable === "rejected-only" && (r.status === "rejected" || r.status === "missing"));

  async function onFile(r: ChecklistRow, file: File | undefined) {
    if (!file) return;
    setBusy(r.kind);
    setErrors((e) => ({ ...e, [r.kind]: "" }));
    const form = new FormData();
    form.set("file", file);
    const res = await upload(r.kind, form).catch(() => ({ ok: false as const, error: "Upload failed. Check your connection and try again." }));
    setBusy(null);
    if (res.ok) router.refresh();
    else setErrors((e) => ({ ...e, [r.kind]: res.error }));
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((r) => (
        <li key={r.kind} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium">{r.label}</span>
            {r.note ? <span className="text-sm text-destructive">{r.note}</span> : null}
            {r.sha256 ? <span className="font-mono text-xs text-muted-foreground">{`${r.sha256.slice(0, 8)}…${r.sha256.slice(-6)}`}</span> : null}
            {errors[r.kind] ? (
              <span role="alert" className="text-sm text-destructive">
                {errors[r.kind]}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <DocumentStatusBadge status={r.status} />
            {canUpload(r) ? (
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-card px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring [@media(hover:hover)]:hover:border-muted-foreground [@media(hover:hover)]:hover:bg-muted">
                {busy === r.kind ? "Uploading" : r.status === "missing" ? "Upload" : "Replace"}
                <input
                  type="file"
                  aria-label={`${r.status === "missing" ? "Upload" : "Replace"} ${r.label}`}
                  className="sr-only"
                  disabled={busy !== null}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.docx,.zip"
                  onChange={(e) => void onFile(r, e.target.files?.[0])}
                />
              </label>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
