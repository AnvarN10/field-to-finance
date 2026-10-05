"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "./logo-mark";

const NAV = [
  { href: "/pools", label: "Pools" },
  { href: "/investor", label: "Investor" },
  { href: "/farmer", label: "Farmer" },
  { href: "/arranger", label: "Arranger" },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function SiteHeader({ walletSlot }: { walletSlot?: ReactNode }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Close the phone menu after navigation.
  useEffect(() => setOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight">
          <LogoMark />
          <span className="max-sm:sr-only">Field-to-Finance</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 hover:bg-muted ${
                    active ? "font-medium text-primary underline decoration-2 underline-offset-[18px]" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-2">{walletSlot}</div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
            className="ml-1 inline-flex size-9 items-center justify-center rounded-md hover:bg-muted active:scale-[0.98] motion-reduce:active:scale-100 md:hidden"
          >
            {open ? <X aria-hidden strokeWidth={1.5} className="size-5" /> : <Menu aria-hidden strokeWidth={1.5} className="size-5" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-border bg-background px-4 py-2 md:hidden">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-md px-3 hover:bg-muted ${
                  active ? "font-medium text-primary" : "text-muted-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
