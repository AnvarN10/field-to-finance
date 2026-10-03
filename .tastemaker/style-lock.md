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
- Warning: wheat #F2C14E
- Dark mode: this IS the single mode. No light theme, no runtime toggle. Map basemap (satellite) sits directly on the dark surface.

## Color contract

Matrix: `check_contrast.py --matrix text=#EDEFEA bg=#0B0D0C surface=#151916 primary=#F2C14E accent=#3DDC97 border=#2A302C on-primary=#1A1405`

- Text-safe (>=4.5): text/bg, text/surface, text/border, text/on-primary, bg/primary, surface/primary, primary/border, primary/on-primary, bg/accent, surface/accent, accent/border, accent/on-primary. Extra pairs: muted on bg 6.47, muted on surface 5.90, info on bg 9.07, danger on bg 6.98.
- Decorative (<3.0): border against bg/surface (hairlines only), raised against surface.

Rules: wheat is the one brand colour; use it for the primary action, the key number on a card and the funding meter, not as decoration on every element. Green is semantic (open, verified, success), never a second brand colour. Focus ring: 2px wheat outline, offset 2px. Never put muted text on raised.

## Typography
- Family: Instrument Sans (Google Fonts, variable 400–700), one family for headings, body and UI. The reference site uses a proprietary "CC Sans"; Instrument Sans is an open grotesk with similar width and a slightly editorial character.
- Numbers: `font-variant-numeric: tabular-nums` for every amount, percentage and table column.
- Mono: JetBrains Mono, only for addresses, signatures and hashes (truncated in the middle).
- Scale (6 steps, app pages capped at 24px): 12, 14, 16, 20, 24 on app pages; landing adds 40 / 56 for the hero. Headings letter-spacing -0.02em, line-height 1.15; body line-height 1.6.

## Shape language
- Corner radius: 6px controls and chips, 10px panels, 999px only for status pills. No nested rounded containers.
- Shadow depth: flat. Separation by surface tint and 1px hairlines; a single soft shadow (0 8px 24px rgb(13 32 25 / 0.08)) only for popovers and dialogs.
- Border usage: 1px #b2b9a8 hairlines between table rows and panel edges.

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
- Build stamp / log: `.tastemaker/log.json` once the landing is built.

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
- Pending review: palette and font choice (logged 2026-10-03).

## Navigation chrome
- Top bar background: Background with bottom hairline. Content area: Background.
- Active nav item: Primary text with 2px Primary underline. Hover: Inlay background.
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
- Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for scrubbed scroll.
- Durations: press 100ms, hover 150ms, popover 160ms, panel 220ms, list item stagger 40ms (max 8 items), landing reveals 500–700ms, number tickers 900ms.
- Landing: hero field outline draws itself over the satellite tile (stroke-dashoffset), then the pool card rises; the seven-step deal path animates as a scrubbed rail on scroll; the problem tagline lights word by word; funded amounts count up once when in view; one pinned section is allowed.
- App: list and table rows enter with a short stagger on first data load; funding meter animates width once on mount (transform: scaleX, not width); transaction status changes animate once (pending spinner → success check draw → explorer link); buttons press-scale 0.98; skeletons shimmer while loading.
- Frequency rules: nothing animates on refetch or polling; no animation on repeated table updates; hover lift only under (hover: hover).
- Reduced motion: no movement, opacity fades ≤150ms, tickers show the final value.
- Verified by: `scripts/audit_motion.py` clean + browser check.

## Do not
- Purple, cyan or neon accents; gradient text; glowing card shadows.
- APY-style hype numbers; show "Fixed yield 12.0%" with the term.
- Em dashes in UI copy.
