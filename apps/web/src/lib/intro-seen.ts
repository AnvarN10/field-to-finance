/**
 * The landing hero intro plays once per browser session. The CSS animates it only under
 * `html:not([data-seen])` (globals.css, "Hero intro").
 *
 * - `introSeenScript` runs inline in <head> before first paint: if this session already saw the intro it sets
 *   `data-seen` on <html>, so the hero paints in its end state with no flash. <html> has suppressHydrationWarning
 *   because React did not render that attribute.
 * - `markIntroSeen` runs when the landing mounts: it records the view and switches the intro off once it has
 *   played, so client-side navigation back to `/` does not replay it either.
 * Storage can throw (private mode, blocked site data); then the intro simply plays.
 */
export const INTRO_SEEN_KEY = "f2f:intro-seen";

/** Longer than the last intro animation to finish: second field fill, 550 + 600ms delay + 500ms. */
export const INTRO_MS = 2000;

export const introSeenScript = `try{if(sessionStorage.getItem(${JSON.stringify(INTRO_SEEN_KEY)}))document.documentElement.setAttribute("data-seen","")}catch(e){}`;

export function markIntroSeen(root: HTMLElement, storage: () => Storage = () => window.sessionStorage): void {
  if (root.hasAttribute("data-seen")) return;
  try {
    storage().setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the intro still switches off for this page view below.
  }
  // Not cleared on unmount: setting the attribute after leaving the page is harmless and keeps it idempotent.
  setTimeout(() => root.setAttribute("data-seen", ""), INTRO_MS);
}
