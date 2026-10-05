import type { ReactNode } from "react";

/** A titled block of a cabinet page; `action` sits on the trailing edge of the heading row. */
export function Section({ title, description, action, children, id }: { title: string; description?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-xl font-semibold">
            {title}
          </h2>
          {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Panel surface for grouped content (one level only: never nest panels). */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-6 ${className ?? ""}`}>{children}</div>;
}

export const primaryLink =
  "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-[background-color,scale] duration-150 ease-(--ease-out) active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-primary-hover";
/** Secondary links stay neutral, so wheat is left for the one primary action on the screen (style lock). */
export const textLink = "rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current";
