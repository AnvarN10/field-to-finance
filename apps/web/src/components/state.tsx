import { AlertTriangle, Inbox } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const retryCls =
  "inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted";

export function EmptyState({ title, body, action, level = 2 }: { title: string; body: string; action?: ReactNode; level?: 1 | 2 }) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6">
      <Inbox aria-hidden strokeWidth={1.5} className="size-5 text-muted-foreground" />
      <H className="text-base font-semibold">{title}</H>
      <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  retryHref,
  onRetry,
  level = 2,
}: {
  title: string;
  body: string;
  retryHref?: string;
  onRetry?: () => void;
  /** 1 when the state is the whole page, so the page keeps its h1. */
  level?: 1 | 2;
}) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive bg-card p-6">
      <AlertTriangle aria-hidden strokeWidth={1.5} className="size-5 text-destructive" />
      <H className="text-base font-semibold">{title}</H>
      <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
      {retryHref ? (
        <Link href={retryHref} className={retryCls}>
          Try again
        </Link>
      ) : onRetry ? (
        <button type="button" onClick={onRetry} className={retryCls}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
