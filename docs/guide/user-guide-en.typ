// Field-to-Finance user guide (English). Build: docs/guide/build.sh
#let wheat = rgb("#F2C14E")
#let ink = rgb("#1A1405")
#let night = rgb("#0B0D0C")
#let muted = luma(95)

#set document(title: "Field-to-Finance: User Guide", author: "Field-to-Finance", date: datetime(year: 2026, month: 10, day: 10))
#set text(font: "PT Sans", size: 10pt, lang: "en", fill: night)
#set par(justify: false, leading: 0.62em, spacing: 0.9em)
#show link: set text(fill: rgb("#7a5a00"))
#show raw: set text(font: "Menlo", size: 8.5pt)
#set table(inset: 5pt, stroke: 0.5pt + luma(200), align: left)
#show table: set text(size: 8.8pt)
#set list(indent: 0.4em, spacing: 0.6em)
#set enum(indent: 0.4em, spacing: 0.6em)
#show figure.caption: set text(size: 8.5pt, fill: muted)
#set figure(gap: 0.6em)

// Numbered steps: counter restarts with every #steps block.
#let steps(..items) = enum(numbering: n => box(fill: wheat, inset: (x: 4pt, y: 2pt), radius: 3pt, text(fill: ink, weight: "bold", size: 8.5pt, str(n))), ..items)

// Screenshot with a caption. h: height for tall screenshots; otherwise full text width.
#let shot(file, caption, h: none, w: 100%) = figure(
  box(stroke: 0.6pt + luma(170), radius: 3pt, clip: true,
    if h == none { image("screens/" + file, width: w) } else { image("screens/" + file, height: h) }),
  caption: caption,
)
#let pair(a, ca, b, cb, h: 11cm) = grid(columns: (1fr, 1fr), gutter: 12pt, shot(a, ca, h: h), shot(b, cb, h: h))

#let note(body) = block(fill: rgb("#FBF3DC"), stroke: (left: 3pt + wheat), inset: 9pt, radius: 2pt, width: 100%, body)
#let role(name) = box(fill: ink, inset: (x: 5pt, y: 2pt), radius: 3pt, text(fill: wheat, size: 8.5pt, weight: "bold", name))

// ---------------- Cover ----------------
#page(fill: night, margin: 2.4cm, numbering: none)[
  #set text(fill: white)
  #v(3cm)
  #image("logo.svg", width: 2.6cm)
  #v(1.2cm)
  #text(size: 34pt, weight: "bold")[Field-to-Finance]
  #v(0.2cm)
  #text(size: 18pt, fill: wheat)[User Guide]
  #v(0.8cm)
  #block(width: 13cm, text(size: 11.5pt, fill: luma(210))[
    Financing next season's harvest against verified fields, with a pooled instrument on Solana.
    Step-by-step instructions for investors, farmers and the F2F team.
  ])
  #v(1fr)
  #text(size: 9pt, fill: luma(170))[
    Platform: https://field-to-finance.up.railway.app \
    Edition: October 10, 2026 · Solana devnet pilot with test USDC \
    Nothing in this guide or on the platform is an offer of securities.
  ]
]

#set page(paper: "a4", margin: (x: 2cm, top: 2.2cm, bottom: 2cm), numbering: "1",
  header: context { if counter(page).get().first() > 2 [
    #set text(size: 8pt, fill: muted)
    Field-to-Finance · User Guide #h(1fr) Solana devnet pilot
    #v(-4pt) #line(length: 100%, stroke: 0.4pt + luma(210))
  ] })

#set heading(numbering: "1.1")
#show heading.where(level: 1): it => { pagebreak(weak: true); block(below: 1em)[#text(size: 20pt, weight: "bold", it)]; v(2pt); line(length: 3cm, stroke: 2.5pt + wheat); v(6pt) }
#show heading.where(level: 2): it => block(above: 1.6em, below: 0.8em, text(size: 13.5pt, weight: "bold", it))
#show heading.where(level: 3): it => block(above: 1.3em, below: 0.6em, text(size: 11pt, weight: "bold", it))

// ---------------- Contents ----------------
#page(numbering: none)[
  #text(size: 20pt, weight: "bold")[Contents]
  #v(0.5cm)
  #outline(title: none, depth: 2, indent: 1.2em)
]
#counter(page).update(1)

// =====================================================================
= Overview

Field-to-Finance (F2F) lets farmers in Kazakhstan raise working capital for next season against part of their expected harvest. Up to 30% of a farm's expected volume backs an instrument; the rest is a buffer. Fields are verified by satellite by the SCAS partner, an arranger packages verified farm projects into a pooled Token-2022 instrument (for example `WHEAT-2027`), and investors buy it with USDC on Solana. After harvest the farmer either buys the tokens back for principal plus coupon, or holders receive a share of the grain stored at the elevator.

#note[
  *Pilot disclaimer.* The platform runs on *Solana devnet* with *test USDC*. No real money moves and nothing on the platform is an offer of securities. Field checks come from a SCAS stub while the external provider is integrated. Users never need SOL: F2F's gas sponsor pays network fees and account rent.
]

== The lifecycle of a pool

#table(columns: (auto, 1fr, auto),
  table.header([*Step*], [*What happens*], [*Who acts*]),
  [1. Application], [The farmer's company signs up at `/apply`, fills in the company profile, creates an application, uploads one document per requirement and registers field boundaries on-chain.], [Farmer],
  [2. KYC], [Compliance reviews the issuer KYC file and approves the company's issuer wallet on-chain. Investors go through their own KYC in the investor app.], [Compliance],
  [3. Field verification], [The SCAS partner checks each field boundary against imagery and writes a `FieldVerified` attestation per field.], [SCAS partner],
  [4. Structuring and publish], [The arranger builds the term sheet (nominal, coupon, settlement mode, dates, fees), creates the pool with the farm project and publishes it.], [Arranger],
  [5. Subscription], [Approved investors accept the pool's key features document and subscribe with test USDC. The instrument arrives in the same transaction.], [Investors],
  [6. Disbursement], [When the pool is funded, the arranger closes the subscription and disburses the proceeds to the farmer, net of the arrangement fee.], [Arranger],
  [7. Season attestations], [Sowing, vegetation and the pre-harvest yield estimate are attested on-chain for every field.], [SCAS partner],
  [8. Harvest receipt and lab quality], [On the delivery path the elevator records what it received and the laboratory records a 12-parameter protocol against the pool's quality spec.], [Elevator, laboratory],
  [9. Buyback or delivery], [Before maturity the farmer elects a cash buyback and funds the vault, or delivery applies.], [Farmer],
  [10. Redemption or grain claim], [After maturity holders redeem tokens for principal plus coupon, or burn them for a Grain Claim on the elevator.], [Investors],
  [11. Close], [The arranger records settlement, sweeps the vault remainder and the pool is complete.], [Arranger],
)

== Roles and where they work

Each audience enters through its own door and sees only its own app. One sign-in page (`/sign-in`) sends every returning user home.

#table(columns: (auto, auto, 1fr),
  table.header([*Role*], [*App*], [*How you get access*]),
  [Investor], [`/invest`], [Self sign-up at `/invest/signup`, then verification in the app.],
  [Farmer / issuer], [`/issuer`], [Self sign-up at `/apply` → "Apply for financing".],
  [Arranger], [`/console`], [Invitation only. Holds every console permission.],
  [Compliance], [`/console`], [Invitation only. Issuer and investor KYC, revocations, retail limits.],
  [SCAS partner], [`/console`], [Invitation only. Field verification and season attestations.],
  [Elevator], [`/console`], [Invitation only. Elevator receipts for delivery pools.],
  [Laboratory], [`/console`], [Invitation only. 12-parameter lab protocols.],
  [Regulator], [`/console`], [Invitation only. Read-only registry, holders, events and CSV exports.],
)

An email can hold one self-service account (investor or farmer) and, separately, console roles. Sign-in is by email with a one-time code (Privy); every account gets an embedded Solana wallet with no seed phrase.

// =====================================================================
= Public pages

Anyone can open the public pages; no account is needed.

== Landing page

The landing page (`/`) explains the problem (inputs are paid in spring, grain arrives in autumn), shows the featured open pool with its imagery, the seven steps of a deal and the investor protections (the 70% buffer, shortfall rules, frozen instrument accounts until KYC). The two calls to action are *Start investing* and *Apply for financing*.

#shot("public-landing.jpg", [Landing page (production).], h: 21cm)

== Pools list

*Pools* in the top bar (`/pools`) lists every listed pool with its status, fixed yield, amount raised against the target, crop and season, and maturity. Click a card to open the pool.

#shot("public-pools.jpg", [Pools list.])

== Pool page

The pool page (`/pools/<id>`) is the full term sheet:

- *Invest* panel: connect a Solana wallet on devnet to buy whole tokens (see the investor chapter).
- *Status* with links to the pool, the instrument mint and the USDC vault in Solana Explorer.
- *Issuer*: the issuer of record and its KYC status.
- *Instrument*: type (for example Hybrid: grain delivery with the issuer's right to buy the token back), nominal per token, number of tokens, issue size, coupon (Act/360), interest start, maturity, and the payout per token.
- *Settlement*: the issuer's election, elevator receipt, lab certificate and grain claimed so far.
- *Commodity*: the 12-parameter quality spec; its hash is stored on-chain.
- *Volume and delivery*, *Farmer requirements* (document checklist), *Farm projects* with fields and SCAS checks, *Fees*, *Risks* and the *Season* timeline with every attestation and its evidence.

#shot("public-pool.jpg", [Public pool page with the term sheet (production).], h: 21cm)

#pair("public-landing-390.jpg", [Landing on a phone.], "public-pool-390.jpg", [Pool page on a phone.], h: 12cm)

// =====================================================================
= Investor

== Sign up

#steps(
  [Click *Start investing* on any public page, or open `/invest/signup`.],
  [Read the three steps (verify once, read each pool's key features, subscribe with USDC) and the risk note.],
  [Click *Continue with email*, enter your email and the one-time code.],
  [Your investor account opens straight away, with an embedded Solana wallet. You land in the investor app.],
)

#shot("invest-signup.jpg", [The investor door at `/invest/signup`.])

== Sign in

Returning users click *Sign in* and then *Continue with email*. After the code you land in your own app: investors in `/invest`, farmers in `/issuer`, console members in `/console`. An email with no account sees links to both doors.

#shot("sign-in.jpg", [One sign-in page for all audiences.])

== Account and verification (KYC)

Open *Account* (`/invest/account`). Four steps must be done before you can subscribe:

#steps(
  [*Investor category.* Choose Professional, Retail or Institutional, your net assets and your experience with bonds or structured products; optionally say why you qualify. Click *Save answers*. Retail investors see the exempt-offer limits: fewer than 50 retail investors in 12 months, USD 100,000 minimum per investor, up to USD 5M from retail investors in 12 months.],
  [*Identity check.* Enter your full name, country of residence and, for Kazakhstan residents, the optional 12-digit IIN. Click *Send for review*. Compliance reviews it in the console; these values stay in the platform's private database and never go on-chain.],
  [*Risk acknowledgement.* Read the risks and click *I understand these risks*.],
  [*Wallet.* Your email wallet appears automatically after sign-in. To invest from Phantom, click *Connect wallet* and sign a message to link it (signing costs nothing).],
)

When compliance approves your KYC, every linked wallet receives the platform KYC record on-chain (`approve_investor`) and you get an update. Wallets linked later are approved when linked.

#shot("invest-account-kyc.jpg", [Account: category saved, identity check waiting to be sent.], h: 19cm)

#shot("invest-account.jpg", [Account after approval: onboarding complete, two linked wallets.], h: 18cm)

== Overview

*Overview* (`/invest`) shows the value of your positions at maturity, the coupon accrued to date, test USDC in your linked wallets, the next payment, upcoming payments by maturity date and updates (KYC decisions, new pools, confirmations).

#shot("invest-overview.jpg", [Investor overview.])

== Find a pool

*Opportunities* lists pools open for subscription and, below, funded pools that are settling. Open a pool to read its key features and subscribe.

#shot("invest-opportunities.jpg", [Opportunities.])

== Buy (subscribe)

#steps(
  [Open the pool from *Opportunities*. The *Key features document* comes first: issuer of record, instrument, nominal, issue size, coupon, the grain behind the token, dates, settlement, fees and the main risks, with the document's SHA-256.],
  [If onboarding is not finished, the page says so and links to *Go to onboarding*.],
  [Click *Accept and continue to subscribe*. The acceptance is recorded for this pool; it is required before the first subscription.],
  [In the *Invest* panel, connect the wallet you will pay from (your email wallet, or Phantom on Devnet). The panel shows your KYC status, test USDC balance and what you already hold.],
  [Enter the number of *Tokens*. The summary shows tokens × nominal, the network fee and the total. No SOL is needed.],
  [Click *Subscribe · \$total* and approve in the wallet. On success the panel says the instrument is in your wallet.],
)

The server checks before the wallet opens that the wallet is linked to an onboarded investor who accepted the key features; a wallet without KYC is rejected with a plain-language message. If your balance is too low, the panel offers test USDC.

#shot("invest-pool-new.jpg", [Key features of a pool, seen before onboarding is complete.], h: 17cm)

#shot("invest-pool.jpg", [Key features accepted; the Invest panel asks to connect a wallet.], h: 19cm)

#shot("invest-pool-connect.jpg", [Connect wallet: a Solana wallet is required on devnet.])

== Portfolio

*Portfolio* (`/invest/portfolio`) lists positions across your linked wallets: tokens, nominal, accrued coupon (Act/360), value at maturity, maturity, settlement path, grain claim and the action available (*Claim grain* or *View pool*). Below are the maturity schedule and *Test funds*: each linked wallet can get 1,000 test USDC.

#shot("invest-portfolio.jpg", [Portfolio with three positions on different settlement paths.])

== Redemption and grain claim

After maturity the Invest panel on the pool page offers the action that applies:

- *Redeem for \$amount*, on the buyback path once the issuer has funded the vault: burns your tokens and pays principal plus the Act/360 coupon.
- *Claim N t of grain*, when grain delivery applies after maturity and the elevator receipt and a passing lab protocol are recorded: burns your tokens and records a Grain Claim on the elevator, pro rata to the tokenized volume.
- *Refund \$amount*, if the pool closed under target: returns your USDC and burns the instrument.

Each action is a sponsored transaction you approve in your wallet.

#shot("invest-pool-claim.jpg", [A delivery pool after maturity: grain delivery applies; connect the holding wallet to claim.], h: 19cm)

== Activity and statement

*Activity* lists your subscriptions, refunds, redemptions and grain claims, each with its transaction. *Download statement (CSV)* exports them.

#shot("invest-activity.jpg", [Activity (empty for this demo account).])

#shot("invest-overview-390.jpg", [Investor overview on a phone.], h: 13cm)

// =====================================================================
= Farmer / issuer

== Apply

#steps(
  [Click *Apply for financing* on the landing page (`/apply`). The page lists what you need: crop insurance; land-use right (state act and cadastral numbers); financial statements and encumbrance certificate; historical field yields; field imagery; company registration and director identity for issuer KYC.],
  [Click *Apply for financing* and then *Continue with email* (`/apply/start`). Use the email of the person who will run the application.],
  [After the one-time code your issuer workspace opens. Your company gets a secure wallet with no seed phrase; it becomes the issuer wallet of your pool.],
)

#shot("apply.jpg", [What F2F finances and what you need.], h: 16cm)

#shot("apply-start.jpg", [Issuer sign-up.])

== Company profile and issuer KYC

Open *Company* (`/issuer/company`):

#steps(
  [*Company profile*: legal name, 12-digit BIN, region, contact person and phone. Click *Save profile*. Legal name and BIN stay in private storage and never go on-chain.],
  [*Issuer KYC*: upload the charter and director ID. The status shows "Waiting for review" until compliance decides. You can keep preparing your application meanwhile.],
  [*Your issuer wallet* is shown with an Explorer link. Issuer KYC approves exactly this wallet.],
)

#shot("issuer-company.jpg", [Company profile, issuer KYC waiting for review, term-sheet checklist.], h: 17cm)

== Create an application

#steps(
  [In *Applications* click *New application*.],
  [Fill in the harvest (crop, grade, season, expected volume in tonnes, tokenized share up to 30%), the financing (amount requested in USD, proposed coupon; the arranger sets the final coupon) and delivery (elevator and laboratory).],
  [Click *Create application*. The application opens as a *Draft*.],
)

#shot("issuer-new.jpg", [New application.])

== Documents

Each requirement has its own row: click *Upload* for missing documents (PDF, image, CSV, XLSX, DOCX or ZIP, up to 10 MB each). Only arrangers and you can open them. In a draft you can *Replace* any document; after submission only a rejected document can be uploaded again. Every row shows its status: Missing, In review, Accepted or Rejected (with the reviewer's note).

== Fields

In *Fields*, upload your field boundaries as GeoJSON or KML (up to the per-upload limit of fields; a MultiPolygon counts one field per part). Enter the cadastral number and declared area of each field; a difference of more than 5% from the measured area is flagged. Your wallet signs the sponsored registration (*Confirm sign-in* unlocks it). Registering costs the mint fee in test USDC; if your wallet is short, the page offers test USDC. Cadastral numbers stay in private storage; only polygon hashes and areas go on-chain.

#shot("issuer-app-draft.jpg", [A draft: status timeline, requested terms, documents (three uploaded, three missing) and fields.], h: 19cm)

== Submit and follow the status

When the profile is complete, all documents are uploaded and the fields are registered, click *Submit for review*. *Withdraw application* stops the process for good. The status timeline shows every step and who owns it: document review, issuer KYC, field verification, structuring, ready to publish, open for subscription, funded, disbursed, in season, harvest, settlement, closed. From *Open for subscription* on, statuses come from the chain.

#shot("issuer-app-verif.jpg", [Submitted application waiting for field verification by the SCAS partner.], h: 19cm)

== Issuer workspace

*Overview* (`/issuer`) shows one *Next step* in plain words and who owns it, your applications, your obligations and updates (document decisions, KYC decisions, status changes).

#shot("issuer-overview-draft.jpg", [Overview of a company with a draft application.])

#shot("issuer-overview.jpg", [Overview after disbursement: proceeds paid, obligation due at maturity.], h: 17cm)

#shot("issuer-applications.jpg", [Applications list.])

== Settlement and buyback funding

*Obligations* (`/issuer/obligations`) shows for each pool: the amount due at maturity (principal plus coupon accrued Act/360 in whole days), the funding deadline, the buyback funding against the vault balance, and the election.

#steps(
  [*Elect* before maturity: buyback (you buy the tokens back for principal plus coupon) or delivery (holders claim grain at the elevator; delivery is final). Without a buyback election grain delivery applies.],
  [On the buyback path, click *Fund buyback · \$shortfall* and approve in your wallet. Deposits open once the proceeds are disbursed. Fund by maturity: an elected buyback not funded within 7 days of maturity lapses into delivery.],
  [*Payouts and fees* lists the proceeds you received and the fees withheld.],
)

Only the issuer wallet of the pool can sign the election and the funding; the page asks you to sign in with that wallet otherwise.

#shot("issuer-obligations.jpg", [Obligations: one pool on the delivery path, one buyback funded in full.], h: 15cm)

// =====================================================================
= Console (F2F team and partners)

The console (`/console`) is one back office for the arranger, compliance, the SCAS partner, the elevator, the laboratory and the regulator. The left navigation shows only the sections your roles open, and buttons render only with their permission. Under 1024 px wide the navigation moves into a menu.

== Joining the console

Console access is by invitation only. A team manager sends you a link (`/invite/<token>`). Open it, click *Continue with email* and sign in with the invited address; the link works once, only for that email, and expires after 7 days. Someone signed in without console roles sees "The console is for invited team members".

#pair("invite-anon.jpg", [An invitation link: roles and the masked email.], "console-not-member.jpg", [Signed in, but not a console member.], h: 6.2cm)

== Inbox

The *Inbox* shows what waits for you in queues by permission: applications to review, issuer KYC, investor KYC, fields to verify, pool actions where the arranger acts next, elevator receipts and lab protocols. Each item links to the place where you act.

#shot("console-inbox.jpg", [Arranger inbox: six queues.])

#grid(columns: (1fr, 1.6fr), gutter: 14pt,
  shot("console-inbox-390.jpg", [Console on a phone.], h: 11cm),
  shot("console-inbox-scas.jpg", [The same inbox for the SCAS partner: one queue, one section.]),
)

== Arranger #role("arranger")

=== Applications pipeline

*Applications* shows the issuance pipeline by stage (Intake, Diligence, Structuring, Live, Closed) with filters by status. Open an application for its record: status timeline, the next step with its button, documents, activity log, issuer details and requested terms.

#shot("console-applications.jpg", [Issuance pipeline.])

=== Review an application

#steps(
  [*Start document review* on a submitted application.],
  [For each document, download and *Accept* or *Reject* with a note; the farmer can re-upload a rejected document.],
  [*Move to issuer KYC* once every required document is accepted.],
  [After compliance approves the issuer's KYC, *Move to field verification*.],
  [When the SCAS partner has verified every field, *Move to structuring*. A button that is not available says why (for example "Verify every field first").],
  [*Reject application* is available at any stage after submission, with a reason.],
)

#shot("console-app-review.jpg", [Application record during document review.], h: 19cm)

#shot("console-app-verif.jpg", [Field verification: the next step waits for the SCAS partner.], h: 21cm)

=== Structure and publish

#steps(
  [In *Structuring*, the term builder asks for the instrument name and symbol, nominal per token (it must divide the requested amount into whole tokens), coupon (% a year, Act/360), settlement (Hybrid, Cash buyback or Grain delivery), subscription close and maturity (in minutes, for the pilot) and the arrangement fee. Volume, tokenized share, elevator and laboratory come from the application.],
  [Click *Create the pool and add the project*. The pool is created on devnet with its InstrumentTerms; the farmer's wallet is the issuer of record.],
  [When the application is *Ready to publish*, click *Publish the pool*. It opens to investors and approved investors get an update.],
)

#shot("console-app-structuring.jpg", [Term builder in the structuring step.], h: 21cm)

=== Lifecycle board, disburse and close

*Pools* lists every pool on devnet with its lifecycle (Subscription, Funding, Season, Harvest and delivery, Settlement, Closing), who acts next and your button when the step is yours. *Settlement* shows the pools at harvest, settlement or closing, earliest maturity first. Open a pool for its record, the *Final report (CSV)* and the manual pilot tools.

#shot("console-pools.jpg", [Live pools: lifecycle board.], h: 20cm)

#shot("console-pool10.jpg", [A pool record where the arranger acts next: record the settlement.])

The manual pilot tools ("for exceptions only") group every pool action with the key that signs it:

#table(columns: (auto, 1fr),
  table.header([*Group*], [*Actions*]),
  [1. Build the pool], [Add a verified project; *Open pool*.],
  [2. Investors], [*Approve investor (all pools)* for a wallet; *Close subscription*.],
  [3. Pay farmers and attest the season], [*Disburse to every project* (arrangement fee withheld for the treasury); *Attest sowing / vegetation / harvest for all fields*.],
  [4. Settle and redeem], [*Record settlement* per project with its shortfall rule; *Fund redemption*; *Sweep vault remainder* (asks for confirmation); *Revoke investor*.],
  [5. Term sheet settlement], [*Elect buyback* or *Elect delivery*; record an elevator receipt or lab certificate with its file.],
)

Every action shows why it is unavailable (for example "Attest harvest first", "Needs a Redeeming pool"). Irreversible actions ask for an inline confirmation whose button names the consequence. Every decision and on-chain action is written to the audit log.

#shot("console-pool9-tools.jpg", [Pool record with the manual pilot tools expanded.], h: 21cm)

#shot("console-settlement.jpg", [Settlement: pools at harvest, settlement or closing.], h: 17cm)

=== Audit and settings

*Audit* lists every decision and on-chain action, newest first, with its transaction; failed attempts are kept with the error. *Settings* shows the platform fees (network fee per subscription, mint fee per project, arrangement fee cap), the treasury and its USDC, the gas sponsor and its SOL, and a form to mint test USDC for demo investors.

#shot("console-audit.jpg", [Audit log.], h: 17cm)

#shot("console-settings.jpg", [Fees and treasury.])

== Compliance #role("compliance")

=== Issuer KYC

*Issuers* lists companies waiting for a decision with legal name, BIN, region, contact and account. Click *Download the KYC documents*, then *Approve issuer KYC* or *Reject* with a reason. Approval writes the platform KYC record on-chain for the company's issuer wallet, signed by the compliance key.

#shot("console-issuers.jpg", [Issuer KYC queue.])

=== Investor KYC and retail limits

*Investors* shows submissions waiting for a decision: category, net assets, experience, why they qualify, full name, country, IIN, risk acknowledgement and wallets. Check the category against the answers, then *Approve KYC* (writes the KYC record for every linked wallet) or *Reject*. Approved investors can be revoked with *Revoke KYC*, which clears the on-chain approval of every linked wallet and freezes its holdings. *Retail limits* monitors the AIFC exempt offer from confirmed subscriptions.

#shot("console-investors.jpg", [Investor KYC: one waiting, one approved.], h: 15cm)

#shot("console-limits.jpg", [Retail limits monitor.])

== SCAS partner #role("SCAS")

#steps(
  [Open *Verification*. *Fields waiting for verification* shows each project's fields on satellite imagery with their areas.],
  [Check every boundary against the imagery, then click *Verify fields*. One `FieldVerified` attestation per field is written, signed by the SCAS key.],
  [Under *Pools in season*, open a funded pool. Choose the stage (Sowing, Vegetation, Yield estimate before harvest), write the observation, attach an optional evidence file and click *Record attestation*. One attestation per field of the pool is written; the file stays private and its hash goes into the public evidence record.],
)

Season attestations open only once the pool is Funded or Redeeming. The SCAS partner sees no company identity.

#shot("console-verification.jpg", [Verification queue with the field map.])

#shot("console-verification-pool.jpg", [Recording a season attestation and the season timeline.])

== Elevator and laboratory #role("elevator") #role("lab")

*Delivery* lists the pools on the delivery path with the receipt and protocol status. Holders can claim grain once the receipt and a passing protocol are recorded after maturity.

- *Elevator*: for the selected pool enter the tonnes received, the receipt number, the date and the receipt file, then click *Record receipt*. Only a hash of the receipt number is stored; the file stays private.
- *Laboratory*: enter the measured value of each of the 12 parameters (crop, class, gluten, protein, moisture, falling number, test weight, impurities, odour, gluten deformation index, vitreousness, pest infestation). Each row shows pass or fail against the pool's quality spec and the form shows a verdict. Attach the protocol file and click *Record lab protocol*.

#shot("console-delivery-elevator.jpg", [Elevator receipt form.])

#shot("console-delivery-lab.jpg", [Laboratory: 12-parameter protocol against the quality spec.], h: 17cm)

== Regulator #role("regulator")

*Registry* is read-only: every published pool with its issuer, BIN, status, money raised, coupon, maturity and holders. Filter by status, pool, issuer BIN or investor IIN. *Export registry (CSV)*, *Holders CSV* and *Events CSV* download the data. Open a pool for its holders and events; *Events* lists the latest 1,000 decisions and on-chain actions with the role that acted. Review notes and personal data are left out.

#shot("console-registry.jpg", [Registry of issues with CSV exports.], h: 15cm)

#shot("console-registry-pool.jpg", [A pool in the registry: holders and events.])

#shot("console-registry-events.jpg", [Platform events.], h: 15cm)

A section outside your roles shows "You do not have access to this section".

#shot("console-forbidden.jpg", [The regulator opening Team.])

== Team (invitations)

*Team* is for users with the team permission (the arranger).

#steps(
  [Under *Invite a member*, enter the email and choose one or more roles: Arranger, Compliance, SCAS partner, Elevator, Laboratory, Regulator.],
  [Click *Create invitation*. The link is shown *once*: click *Copy link* and send it to the invitee yourself (there is no email service in the pilot).],
  [*Open invitations* lists pending links; *Withdraw* revokes one. Inviting the same email again replaces the open invitation.],
  [*Members* lists everyone with their roles; *Edit roles* changes or removes them (the last arranger cannot be removed).],
  [*What each role can do* is the permission matrix. Roles are bundles of permissions defined by the platform.],
)

#shot("console-team-invite.jpg", [A new invitation link, shown once.])

#shot("console-team.jpg", [Team: invite form, open invitations, members and the permission matrix.], h: 21cm)

// =====================================================================
= FAQ and troubleshooting

#let qa(q, a) = block(breakable: false, above: 1.1em)[#text(weight: "bold")[#q] \ #a]

#qa[“Solana devnet did not answer”.][The public devnet RPC is rate-limited. The server retries automatically (up to 4 times with backoff), but a page or a console queue can still show this message. It is usually brief: wait a few seconds and reload. Nothing was lost.]

#qa[“This wallet hasn't passed KYC” or “This token account is frozen”.][Instrument accounts start frozen and only KYC-approved wallets can subscribe or receive the instrument. Finish *Account* (category, identity check, risk acknowledgement), link the wallet you pay from, and wait for compliance to approve. A wallet linked after approval is approved when linked.]

#qa[“Link this wallet in your investor account before subscribing” / “Accept this pool's key features document”.][Subscriptions are checked before the wallet opens. Link the wallet under *Account → Wallet*, and accept the key features document on the pool page.]

#qa[“Not enough test USDC”.][Use *Get 1,000 test USDC* in *Portfolio → Test funds*, or the faucet offered in the invest panel. The faucet allows one request per wallet every 60 seconds and a few per IP every 10 minutes.]

#qa[“A platform account is out of devnet SOL”.][You never need SOL. The gas sponsor or a server key that pays this transaction is empty; nothing was charged. Try again later and tell the F2F team.]

#qa[A sponsored transaction is refused or says “Try again in a minute”.][The gas sponsor co-signs only the exact transaction the platform built, and limits how often it pays: 20 sends per IP per 10 minutes, 300 per hour in total, and a budget for transactions that create accounts at its expense (5 per wallet and 60 in total per hour). Wait and retry.]

#qa[“Your wallet is on a different network”.][Switch Phantom to *Devnet* and try again. On mainnet transactions fail with “Blockhash not found”.]

#qa[“Signature cancelled” or “The transaction expired before it landed”.][Nothing was sent or charged. Try again; on a slow devnet approve promptly.]

#qa[I signed in but see “The console is for invited team members”.][Console access needs an invitation link opened while signed in with the invited email. Ask a team manager.]

#qa[The invitation link does not work.][It works once, only for the invited email, and expires after 7 days. A new invitation to the same email replaces the old link.]

#qa[My buyback funding is disabled.][Deposits open once the proceeds are disbursed, and only the pool's issuer wallet can sign. On the delivery path no funding is needed.]

#v(1fr)
#line(length: 100%, stroke: 0.4pt + luma(200))
#text(size: 8pt, fill: muted)[Screenshots: public pages from the production site; app and console screens from a local server with example.com demo accounts and fictitious company data on Solana devnet. Field-to-Finance · Solana Colosseum, fall 2026.]
