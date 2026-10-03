import { FlaskConical } from "lucide-react";

export const SCAS_STUB_LABEL = "Verified by SCAS stub: external provider pending";

export function ScasStubBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning px-2.5 py-0.5 text-xs font-medium text-warning">
      <FlaskConical aria-hidden strokeWidth={1.5} className="size-3.5" />
      {SCAS_STUB_LABEL}
    </span>
  );
}
