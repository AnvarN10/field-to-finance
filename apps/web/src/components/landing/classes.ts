/** Landing-only class lists, kept out of app/page.tsx (a Next page may not export extra names) so tests can assert them. */

export const heroPrimaryCta =
  "inline-flex h-11 items-center rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground transition-[background-color,scale] duration-100 ease-(--ease-out) active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-primary-hover";

/** Outline CTA on the page background: hover brightens the boundary (control border to muted, 5.90 on surface) and fills with the surface. */
export const heroSecondaryCta =
  "inline-flex h-11 items-center rounded-md border border-input px-5 text-base font-semibold text-foreground transition-[background-color,border-color,scale] duration-150 ease-(--ease-out) active:scale-[0.98] motion-reduce:active:scale-100 active:border-muted-foreground active:bg-card [@media(hover:hover)]:hover:border-muted-foreground [@media(hover:hover)]:hover:bg-card";

/** Problem tagline: 24px at 1.4 on phones, where it wraps to five or six lines; 40px at 1.15 from sm. */
export const taglineClass =
  "max-w-[880px] text-2xl leading-[1.4] sm:text-[40px] sm:leading-[1.15] font-semibold tracking-[-0.02em] text-balance";
