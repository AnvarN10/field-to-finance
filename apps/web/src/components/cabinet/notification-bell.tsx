"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatDateUtc } from "../../lib/format";

type Item = { id: string; title: string; body: string; createdAt: string; readAt: string | null; link: string | null };

/** In-app notifications in every cabinet: unread count on the bell, the latest items in a popover, mark all read. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const load = useCallback(async () => {
    try {
      const r = (await (await fetch("/api/notifications", { cache: "no-store" })).json()) as { ok: boolean; unread?: number; items?: Item[] };
      if (r.ok) {
        setUnread(r.unread ?? 0);
        setItems(r.items ?? []);
      }
    } catch {
      // Notifications are a convenience: a failed load leaves the bell quiet.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    try {
      await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {
      void load();
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] duration-150 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-hover [@media(hover:hover)]:hover:text-foreground"
      >
        <Bell aria-hidden strokeWidth={1.5} className="size-5" />
        {unread ? (
          <span aria-hidden className="tabular absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs leading-none font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="popover-in fixed inset-x-4 top-16 z-50 flex flex-col rounded-lg border border-border bg-card shadow-(--shadow-pop) sm:absolute sm:inset-x-auto sm:end-0 sm:top-11 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread ? (
              <button type="button" onClick={() => void markAllRead()} className="inline-flex min-h-6 items-center rounded-sm px-1 text-xs font-medium text-foreground underline decoration-muted-foreground underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:decoration-current">
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length ? (
            <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`text-sm ${n.readAt ? "text-foreground" : "font-semibold text-foreground"}`}>{n.title}</span>
                      {n.readAt ? null : <span className="sr-only">Unread</span>}
                    </span>
                    <span className="text-xs text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground">{n.body}</span>
                    <time className="tabular text-xs text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground" dateTime={n.createdAt}>
                      {formatDateUtc(Math.floor(new Date(n.createdAt).getTime() / 1000))}
                    </time>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)} className="group flex flex-col gap-1 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-hover">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex flex-col gap-1 px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nothing new.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
