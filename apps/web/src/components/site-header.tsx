"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "./logo-mark";

const NAV = [
  { href: "/pools", label: "Pools" },
  { href: "/apply", label: "Apply for financing" },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);
const primary =
  "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground transition-[background-color,scale] duration-150 ease-(--ease-out) active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-primary-hover";
/** On a door page the page owns the one wheat action; the header's investor door steps back to an outline. */
const outline =
  "inline-flex h-9 items-center rounded-md border border-input bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors duration-150 [@media(hover:hover)]:hover:border-muted-foreground";
const DOOR_PAGES = ["/sign-in", "/apply", "/invite"];
const quiet = "inline-flex h-9 items-center rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-150 [@media(hover:hover)]:hover:bg-hover [@media(hover:hover)]:hover:text-foreground";

/** Where a live session lands (GET /api/session), so a signed-in visitor sees one "Open app" link instead of the doors. */
function useHome(): string | null {
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { signedIn?: boolean; home?: string | null }) => live && setHome(b.signedIn && b.home ? b.home : null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return home;
}

/** Public header (ADR 0018): the catalogue, the farmer door, sign-in and the investor door (the one primary action except on door pages). */
export function SiteHeader() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const home = useHome();

  // Close the phone menu after navigation.
  useEffect(() => setOpen(false), [path]);

  const account = home ? (
    <Link href={home} className={primary}>
      Open app
    </Link>
  ) : (
    <>
      <Link href="/sign-in" className={quiet}>
        Sign in
      </Link>
      {isActive(path, "/invest/signup") ? null : (
        <Link href="/invest/signup" className={DOOR_PAGES.some((d) => isActive(path, d)) ? outline : primary}>
          Start investing
        </Link>
      )}
    </>
  );

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
                  className={`rounded-md px-3 py-1.5 transition-colors duration-150 [@media(hover:hover)]:hover:bg-hover [@media(hover:hover)]:hover:text-foreground ${
                    active ? "font-medium text-primary underline decoration-2 underline-offset-[18px]" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-2 flex items-center gap-1">{account}</div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
            className="ml-1 inline-flex size-9 items-center justify-center rounded-md active:scale-[0.98] motion-reduce:active:scale-100 md:hidden [@media(hover:hover)]:hover:bg-hover"
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
                className={`flex min-h-11 items-center rounded-md px-3 [@media(hover:hover)]:hover:bg-hover ${active ? "font-medium text-primary" : "text-muted-foreground"}`}
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
