# Style lock — Field-to-Finance

Established: 2026-10-03. Source: palette from the CSS custom properties of https://www.commochain.ltd/kk (public site of the same management team, used as the family brand reference at the user's request), adapted for a separate Field-to-Finance product. Fonts, shapes and motion chosen for this project.

## Palette
- Background: #f5f2ea (paper; page background) — source `--paper`
- Surface: #fbfaf5 (panels, table body, inputs; nudged lighter than paper so panels lift without shadows)
- Inlay: #e1e4d3 (table headers, selected rows, quiet chips) — source `--surface-inlay`
- Primary: #142d23 (forest; primary buttons, active nav, key numbers) — source `--surface-forest`
- Primary hover: #19382b — source `--text-forest`
- Accent: #c9a227 (gold; only on Primary or ink fills: badges, progress fill, highlights on dark) — source `--gold`
- Accent text: #79632e (gold as text on paper or surface; "Fixed yield" labels, links in prose) — source `--editorial-gold`
- Ink section: #0d2019 (dark bands: hero visual frame, footer) — source `--surface-ink`
- Text on dark: #dae2d0 — source `--text-on-dark`
- Text primary: #0d2019 — contrast vs background: 15.17 (AA pass)
- Text muted: #455347 — contrast vs background: 7.27 (AA pass) — source `--editorial-muted`
- Border: #b2b9a8 (hairlines, decorative only) — source `--editorial-line`
- Focus ring: #72571f on light (6.06 vs bg), #e6ca8b on dark — source `--focus-light` / `--focus-dark`
- Semantic (added, verified): success #2f6b3f (5.70 vs bg), danger #a3352b (6.05 vs bg), info #2d5a7b (6.56 vs bg). Warning uses Accent text #79632e (5.16 vs bg).
- Button label color: on-primary #f5f2ea — contrast vs Primary: 13.13
- Dark mode: not needed for this project, single light mode with dark ink bands.

## Color contract

Matrix: `check_contrast.py --matrix text=#0d2019 bg=#f5f2ea surface=#fbfaf5 primary=#142d23 accent=#c9a227 border=#b2b9a8 on-primary=#f5f2ea`

- Text-safe (>=4.5): text/surface, text/bg, text/on-primary, surface/primary, bg/primary, primary/on-primary, text/border, primary/border, text/accent, primary/accent. Extra single pairs: muted #455347 on bg 7.27 and on inlay 6.29; text on inlay 13.12; accent-text #79632e on bg 5.16 and on surface 5.52; gold #c9a227 on primary 6.07; text-on-dark #dae2d0 on primary 11.03; success, danger, info on bg as listed above.
- UI-safe (>=3.0 and <4.5): none in the base matrix.
- Decorative (<3.0): surface/accent, bg/accent, accent/on-primary, surface/border, bg/border, border/on-primary, accent/border, text/primary, bg/surface, surface/on-primary, bg/on-primary.

Rules that follow: gold #c9a227 never sits on paper or surface as text, icon or the only state cue; use #79632e there. Borders #b2b9a8 are decorative; any state-carrying border (focus, error, selected) uses focus #72571f, danger #a3352b or primary #142d23. Olive #6e7d5b from the source fails on paper (3.95) and is not used for text.

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
- Section separation: alternating paper and inlay bands, with one ink band for the hero visual and the footer.

## Structure
- Landing: Long-Scroll Narrative. Arc: hook (farmer needs money before harvest) → problem (no grain to pledge yet) → solution (verified fields become an instrument) → how it works (seven-step deal path as a visual rail) → proof (live devnet pool card, explorer links, pilot partners) → close (open the pool).
- App screens: top bar app shell (no sidebar): logo, Pools, Portfolio, Farmer, Admin, wallet button.
- Build stamp / log: `.tastemaker/log.json` once the landing is built.

## Reference intelligence
- Reference board: family brand site viewed via its CSS, rhythm not judged (URL mode blind spot).
- Design read: transactional data product for investors, farmers and hackathon judges, mode Operate on app pages and Persuade on the landing, lane "editorial agri-finance".
- Dials: variance 4, motion 3, density 6, art direction 5.
- Foundation: Next.js + Tailwind + shadcn/ui primitives restyled to these tokens.
- Direction contract: Thesis "a trustworthy field ledger, not a crypto casino"; First viewport "one promise, one live pool card"; System "paper, forest, gold, hairlines, tabular numbers"; Risk "looking like a bank brochure; offset with real map imagery and live on-chain data".
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
- Feel: quick and restrained.
- Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.
- Durations: press 100ms, popover 160ms, panel 220ms, landing reveals 400ms.
- Screen tracks: landing uses light scroll reveals; app pages use list entrance on data load, skeletons and state transitions only.
- Frequency rules: no animation on repeated table updates; transaction status changes animate once.
- Reduced motion: fades only, no movement.

## Do not
- Gold as text or icons on paper.
- Purple, cyan or neon accents; gradient text.
- APY-style hype numbers; show "Fixed yield 12.0%" with the term.
- Em dashes in UI copy.
