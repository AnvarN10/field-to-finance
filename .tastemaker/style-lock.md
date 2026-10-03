# Style lock — Field-to-Finance

Established: 2026-10-03. Source: palette from the CSS custom properties of https://www.commochain.ltd/kk (public site of the same management team, used as the family brand reference at the user's request), adapted for a separate Field-to-Finance product. Fonts, shapes and motion chosen for this project.

## Palette

Revised 2026-10-03 at the user's request ("color combinations don't work"): dark theme with a wheat accent, variant "Night field". The previous CommodityChain paper/forest palette is rejected (see decisions.log).

- Background: #0B0D0C (near-black with a green cast; page background)
- Surface: #151916 (cards, panels, inputs)
- Raised: #1C211E (table headers, hover rows, meter track, skeletons)
- Border: #2A302C (hairlines; decorative only)
- Text primary: #EDEFEA — contrast vs background 17+ (AA pass)
- Text muted: #8E978F — 6.47 vs background, 5.90 vs surface
- Primary / accent: #F2C14E (wheat; primary buttons, key numbers, funding meter, focus ring) — 10.58 vs surface
- On-primary (label on wheat): #1A1405
- Primary hover: #F6CF6E
- Success / field green: #3DDC97 (open status, verified checks, positive deltas)
- Info: #6CB6FF (stub badge, links in prose when not wheat) — 9.07 vs background
- Danger: #FF6B5E — 6.98 vs background
- Warning: no warning hue. Revised 2026-10-04: caution states (Refunding pool, refunded project, KYC not completed) are neutral, muted or foreground text plus their icon (RotateCcw, TriangleAlert, CircleAlert), so wheat stays the one brand colour. No `--color-warning` token exists.
- Dark mode: this IS the single mode. No light theme, no runtime toggle. Map basemap (satellite) sits directly on the dark surface.

## Color contract

Matrix: `check_contrast.py --matrix text=#EDEFEA bg=#0B0D0C surface=#151916 primary=#F2C14E accent=#3DDC97 border=#2A302C on-primary=#1A1405`

- Text-safe (>=4.5): text/bg, text/surface, text/border, text/on-primary, bg/primary, surface/primary, primary/border, primary/on-primary, bg/accent, surface/accent, accent/border, accent/on-primary. Extra pairs: muted on bg 6.47, muted on surface 5.90, info on bg 9.07, danger on bg 6.98.
- Decorative (<3.0): border against bg/surface (hairlines only), raised against surface, skeleton shimmer band #262C28.
- Added 2026-10-03 (redesign build, measured with check_contrast.py):
  - Control border #646E66: 3.35 on surface, 3.68 on background (inputs, selects, checkboxes, disabled-button dashed outline; WCAG 1.4.11 non-text 3:1).
  - Status tints = status colour at 12% over surface: green on #1A3025 7.96, wheat on #302D1D 8.24, danger on #31231F 5.40, info on #1F2C32 6.67.
  - Muted on raised measures 5.42 (passes) but the rule below still stands; table heads sit on the surface, not on raised.
  - Wheat on raised 9.73; text on raised 14.11; on-primary on primary hover 12.27.
  - Overlay for dialogs and the wallet modal: rgb(5 6 5 / 0.72); popover shadow 0 8px 24px rgb(0 0 0 / 0.45).
- Added 2026-10-04 (interface-review fixes, measured with check_contrast.py):
  - Hover surface `--hover` #323833 for ghost and secondary buttons: 1.36 against raised (secondary resting), 1.48 against surface, 1.62 against background (ghost resting); text on it 10.37, wheat on it 7.15. Muted on it is 3.99 (fails), so hover always sets foreground text.
  - Outline buttons and the hero secondary CTA: hover brightens the boundary from control border #646E66 to muted #8E978F (5.90 on surface, 1.76 step from the resting border) and fills with raised (button) or surface (hero CTA on background).
  - Invalid controls: full danger border, 6.36 on surface, plus a 3px danger/20 halo. Disabled controls match the disabled Button: dashed #646E66 outline (3.68 on background), transparent fill, muted text (6.47 on background), no opacity dimming.
  - Components carry no `dark:` variants: <html class="dark"> is permanent, so shadcn's dark alternates would override these tokens.

Rules: wheat is the one brand colour; use it for the primary action, the key number on a card and the funding meter, not as decoration on every element. Green is semantic (open, verified, success), never a second brand colour. Focus ring: 2px wheat outline, offset 2px. Never put muted text on raised.

## Typography
- Family: Instrument Sans (Google Fonts, variable 400–700), one family for headings, body and UI. The reference site uses a proprietary "CC Sans"; Instrument Sans is an open grotesk with similar width and a slightly editorial character.
- Numbers: `font-variant-numeric: tabular-nums` for every amount, percentage and table column.
- Mono: JetBrains Mono, only for addresses, signatures and hashes (truncated in the middle).
- Scale (6 steps, app pages capped at 24px): 12, 14, 16, 20, 24 on app pages; landing adds 40 / 56 for the hero. Headings letter-spacing -0.02em, line-height 1.15; body line-height 1.6.

## Shape language
- Corner radius: 6px controls and chips, 10px panels, 999px only for status pills. No nested rounded containers.
- Shadow depth: flat. Separation by surface tint and 1px hairlines; a single shadow (0 8px 24px rgb(0 0 0 / 0.45)) only for popovers, dialogs and the hero pool card that overlaps the imagery.
- Border usage: 1px #2A302C hairlines between table rows and panel edges; #646E66 for control boundaries.

## Density & spacing
- Base unit: 4px.
- Section padding (landing): connective space-16 (64px), standard space-24 (96px), pivotal (hero, proof) space-32 (128px).
- Content card internal padding: space-6 (24px).
- Compact rows (tables, attestation timeline): space-3 (12px) vertical, 44px min row height.
- Showcase card (Instrument card on the pool page): space-8 (32px).
- Overall density: app pages medium-dense, data first; landing generous and editorial.
- Section separation: background and surface bands, plus hairline dividers; the hero sits on the background with a satellite field visual.

## Structure
- Landing: Long-Scroll Narrative. Arc: hook (farmer needs money before harvest) → problem (no grain to pledge yet) → solution (verified fields become an instrument) → how it works (seven-step deal path as a visual rail) → proof (live devnet pool card, explorer links, pilot partners) → close (open the pool).
- App screens: top bar app shell (no sidebar): logo, Pools, Portfolio, Farmer, Admin, wallet button.
- Build stamp / log: `.tastemaker/log.json` and the stamp at the top of `apps/web/src/app/globals.css`.

## Reference intelligence
- Reference board: family brand site viewed via its CSS, rhythm not judged (URL mode blind spot).
- Design read: transactional data product for investors, farmers and hackathon judges, mode Operate on app pages and Persuade on the landing, lane "editorial agri-finance".
- Dials: variance 5, motion 6, density 6, art direction 6.
- Foundation: Next.js + Tailwind + shadcn/ui primitives restyled to these tokens.
- Direction contract: Thesis "a trustworthy field ledger, not a crypto casino"; First viewport "one promise, a field outline drawing itself on satellite imagery, one live pool card"; System "near-black, wheat, field green, hairlines, tabular numbers, purposeful motion"; Risk "dark DeFi cliché; offset with real map imagery, restraint in colour and no neon".
- Anti-references: neon DeFi dashboards, purple gradients, glowing cards, APY casino styling.

## Taste memory
- Profile priors used: none.
- Decision log: `.tastemaker/decisions.log`.
- Pending review: font choice; redesign motion and hero visual (logged 2026-10-03). Palette kept by the user.

## Navigation chrome
- Top bar background: Background with bottom hairline. Content area: Background.
- Active nav item: Primary text with 2px Primary underline. Hover: Raised background.
- Shell density: 56px top bar, 14px UI text.

## Mood descriptors
calm, grounded, exact, trustworthy

## Assets
- Imagery: real satellite basemap tiles on field pages; no stock photos of smiling farmers.
- Icons: one outline set (Lucide), 1.5px stroke, tinted text or muted.
- Logo: none yet; build a simple geometric field-row mark in Primary and Accent.

## Motion

Raised 2026-10-03 at the user's request ("where are the animations"): expressive landing, alive app.

- Feel: confident and smooth on the landing; quick and purposeful in the app.
- Engine: GSAP + ScrollTrigger on the landing (tastemaker gsap-starter pattern, `gsap.matchMedia()` for reduced motion); Motion (motion/react) or CSS transitions in the app.
- Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (CSS token); cubic-bezier(0.65, 0, 0.35, 1) for scrubbed scroll, applied as GSAP `power2.inOut` (identical cubic) so no `ease-in*` token exists in CSS (audit_motion flags the name).
- Durations: press 100ms, hover 150ms, popover 160ms, panel 220ms, list item stagger 40ms (max 8 items), landing reveals 500–700ms, number tickers 900ms.
- Landing: hero field outline draws itself over the satellite tile (stroke-dashoffset), then the pool card rises, once per browser session (later visits paint the end state: `lib/intro-seen.ts` sets html[data-seen] from sessionStorage before paint, CSS animates only under html:not([data-seen])); the seven-step deal path animates as a scrubbed rail on scroll; the problem tagline lights word by word; funded amounts count up once when in view; one pinned section is allowed.
- App: list and table rows enter with a short stagger on first data load; funding meter fills once on mount with a transform, not width (translate slide-in; scaleX(0) trips the audit's scale-zero rule and squashes the rounded end); transaction status changes animate once (pending spinner → success check draw → explorer link); buttons press-scale 0.98; skeletons shimmer while loading.
- Frequency rules: nothing animates on refetch or polling; no animation on repeated table updates; hover lift only under (hover: hover).
- Reduced motion: no movement, opacity fades ≤150ms, tickers show the final value.
- Verified by: `scripts/audit_motion.py` 0 HIGH + browser frames (2026-10-03).
- Implementation map: hero intro in globals.css ("Hero intro"), scroll beats in `components/landing/landing-motion.tsx`, tickers `components/landing/usd-ticker.tsx`, app classes `.enter-row`, `.meter-fill`, `.check-draw-*`, `.skeleton-shimmer` in globals.css.

## Do not
- Purple, cyan or neon accents; gradient text; glowing card shadows.
- APY-style hype numbers; show "Fixed yield 12.0%" with the term.
- Em dashes in UI copy.
