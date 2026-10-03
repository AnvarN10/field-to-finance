import Link from "next/link";
import { SETTLEMENT_LABELS } from "../../lib/chain/enums";
import type { ProjectWithFields } from "../../lib/chain/views";
import { formatHa, formatTonnes, formatUsd, shortKey } from "../../lib/format";

export function ProjectsTable({ projects }: { projects: ProjectWithFields[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full text-sm whitespace-nowrap">
        <thead className="bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-2.5 py-2 font-medium">Producer</th>
            <th className="px-2.5 py-2 font-medium">Expected</th>
            <th className="px-2.5 py-2 font-medium">Tokenized (30%)</th>
            <th className="px-2.5 py-2 font-medium">Requested</th>
            <th className="px-2.5 py-2 font-medium">Fields</th>
            <th className="px-2.5 py-2 font-medium">Paid out</th>
            <th className="px-2.5 py-2 font-medium">Settlement</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.address} className="border-b border-border last:border-0">
              <td className="px-2.5 py-3 font-mono text-[13px]">{shortKey(p.producer)}</td>
              <td className="px-2.5 py-3">{formatTonnes(p.expectedKg)}</td>
              <td className="px-2.5 py-3">{formatTonnes(p.tokenizedKg)}</td>
              <td className="px-2.5 py-3">{formatUsd(p.requestedAmount)}</td>
              <td className="px-2.5 py-3">
                <ul className="flex flex-col gap-1">
                  {p.fields.map((f) => (
                    <li key={f.address}>
                      <Link href={`/fields/${f.address}`} className="rounded-sm underline decoration-border underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground">
                        Field {f.index + 1}
                      </Link>{" "}
                      <span className="text-muted-foreground">{formatHa(f.areaHaX100)}</span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-2.5 py-3">{p.disbursed ? "Yes" : "Not yet"}</td>
              <td className="px-2.5 py-3">{p.settlement ? SETTLEMENT_LABELS[p.settlement] : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
