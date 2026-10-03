export const MAIN_ID = "main";

/** First focusable element on every page: jumps past the header navigation to the page content. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-[var(--shadow-pop)]"
    >
      Skip to content
    </a>
  );
}
