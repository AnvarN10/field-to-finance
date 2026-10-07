import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { InboxQueue } from "../../lib/workflow/inbox";
import type { ConsoleNavItem } from "./nav-items";

const quietLink = "rounded-sm text-sm font-medium underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current";

/** Work queues of the console inbox; an empty inbox lists the sections the member can open. */
export function Inbox({ queues, sections }: { queues: InboxQueue[]; sections: ConsoleNavItem[] }) {
  const waiting = queues.filter((q) => q.count > 0 || q.unavailable);
  const total = queues.reduce((n, q) => n + q.count, 0);
  return (
    <div className="flex flex-col gap-6">
      {waiting.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6">
          <h2 className="text-base font-semibold">Nothing waiting for you</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {queues.length ? "Every queue you work on is empty. New items appear here as applications, KYC requests and pool steps arrive." : "Your role has no work queues. Open a section:"}
          </p>
          {sections.length ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {sections.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className={quietLink}>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{`${total} ${total === 1 ? "item waits" : "items wait"} for you across ${waiting.length} ${waiting.length === 1 ? "queue" : "queues"}.`}</p>
      )}
      {waiting.length ? (
        <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          {waiting.map((q) => (
            <section key={q.key} aria-labelledby={`q-${q.key}`} className="flex flex-col rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 id={`q-${q.key}`} className="text-base font-semibold">
                  {q.title}
                </h2>
                <span className="tabular rounded-full bg-raised px-2.5 py-0.5 text-xs font-medium">{q.unavailable ? "–" : q.count}</span>
              </div>
              {q.unavailable ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Solana devnet did not answer; this queue is unknown right now.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {q.items.map((i) => (
                    <li key={i.id}>
                      <Link href={i.href} className="group flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm [@media(hover:hover)]:hover:bg-hover">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">{i.label}</span>
                          <span className="truncate text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground">{i.sub}</span>
                        </span>
                        <ChevronRight aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto border-t border-border px-4 py-3">
                <Link href={q.href} className={quietLink}>
                  {q.count > q.items.length ? `Open queue (${q.count})` : "Open queue"}
                </Link>
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
