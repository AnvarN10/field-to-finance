import { Check } from "lucide-react";
import { CONSOLE_ROLE_LABELS, CONSOLE_ROLES, PERMISSION_LABELS, PERMISSIONS, ROLE_PERMISSIONS } from "../../lib/permissions";

/** What each console role may do (read-only; bundles are defined in code, ADR 0018). */
export function PermissionMatrix() {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
              Permission
            </th>
            {CONSOLE_ROLES.map((r) => (
              <th key={r} scope="col" className="px-3 py-3 text-center font-medium">
                {CONSOLE_ROLE_LABELS[r].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {PERMISSIONS.map((p) => (
            <tr key={p}>
              <th scope="row" className="px-4 py-2.5 text-left font-normal">
                <span className="flex flex-col">
                  <span>{PERMISSION_LABELS[p]}</span>
                  <code className="font-mono text-xs text-muted-foreground">{p}</code>
                </span>
              </th>
              {CONSOLE_ROLES.map((r) => (
                <td key={r} className="px-3 py-2.5 text-center">
                  {ROLE_PERMISSIONS[r].includes(p) ? <Check aria-label="Allowed" strokeWidth={1.5} className="mx-auto size-4 text-success" /> : <span className="sr-only">Not allowed</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
