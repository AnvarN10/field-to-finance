"use client";

import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { appsFor } from "../../lib/auth/home";
import type { Role } from "../../lib/db/schema";
import { SignOutButton } from "../cabinet/sign-out-button";

/** Account popover: the signed-in email, the user's other apps (console, issuer workspace, investor app) and sign out. */
export function AccountMenu({ email, roles, current }: { email: string; roles: readonly Role[]; current: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const others = appsFor(roles).filter((a) => a.href !== current);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors duration-150 active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-hover [@media(hover:hover)]:hover:text-foreground"
      >
        <UserRound aria-hidden strokeWidth={1.5} className="size-5" />
        <ChevronDown aria-hidden strokeWidth={1.5} className="size-4" />
        <span className="sr-only">Account</span>
      </button>
      {open ? (
        <div
          id={id}
          role="region"
          aria-label="Account"
          className="popover-in absolute end-0 top-11 z-50 flex w-64 flex-col gap-1 rounded-lg border border-border bg-card p-2 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.45)]"
        >
          <p className="truncate px-2 py-1.5 text-muted-foreground" title={email}>
            {email}
          </p>
          {others.length ? (
            <div className="flex flex-col border-t border-border pt-1">
              {others.map((a) => (
                <Link key={a.href} href={a.href} className="flex min-h-9 items-center rounded-md px-2 [@media(hover:hover)]:hover:bg-hover">
                  {a.label}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="border-t border-border pt-1">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
