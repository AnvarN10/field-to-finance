import type { NotificationRow } from "../../lib/db/schema";
import { formatDateUtc } from "../../lib/format";

/** In-app notifications (no email in this iteration). */
export function Updates({ items }: { items: Pick<NotificationRow, "id" | "title" | "body" | "createdAt" | "readAt">[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing new. Decisions and status changes appear here.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((n) => (
        <li key={n.id} className="flex flex-col gap-1 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{n.title}</span>
            <time className="text-xs text-muted-foreground" dateTime={n.createdAt.toISOString()}>
              {formatDateUtc(Math.floor(n.createdAt.getTime() / 1000))}
            </time>
          </div>
          <p className="text-sm text-muted-foreground">{n.body}</p>
        </li>
      ))}
    </ul>
  );
}
