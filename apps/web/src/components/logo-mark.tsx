"use client";

import { useId } from "react";

// Field-to-finance mark: furrows run to the horizon where a coin rises. Same geometry as app/icon.svg.
export function LogoMark({ className = "size-6" }: { className?: string }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <clipPath id={clip}>
          <rect width="24" height="24" rx="6" />
        </clipPath>
      </defs>
      <rect width="24" height="24" rx="6" fill="var(--primary)" />
      <circle cx="12" cy="8" r="3.4" fill="var(--primary-foreground)" />
      <g clipPath={`url(#${clip})`} stroke="var(--primary-foreground)" strokeWidth="1.7" strokeLinecap="round">
        <path d="M3.5 13.5h17M12 13.5V25M10 13.5 4 25M14 13.5 20 25M8 13.5-3 25M16 13.5 27 25" />
      </g>
    </svg>
  );
}
