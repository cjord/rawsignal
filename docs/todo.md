# To-do and backlog — plan of record

Open UI, platform, data, and signal-model work, grouped by area, each item carrying the
decision context it needs. **Completed items — with their build notes, dates, and
resolved decisions — live in `docs/todo-completed.md`** (split out 2026-09-03 so this
file holds only open work). When something ships, move its entry there with its build
notes; add new items to the matching section here.

Related documents: `docs/roadmap.md` (deferred infra work), `docs/model-gaps.md`
(signal-model gaps register + review calendar), `docs/cloudflare-cutover.md` (D1
runbook), `docs/todo-completed.md` (shipped items and the resolved decision log).

## Accounts and collection saves — in progress (2026-10-19)

- Auction loading and Inventory Manager are released to staging as `b0ae632`,
  version `8d90dbd3-9c64-45e9-81a5-fc3dab2f4bbd`. Full gate and live guest/UI checks
  passed. Cold duplicate catalog calls reduced from 22 to 11; timing samples are
  inconclusive, not a claimed speedup. Production unchanged.
  [Scope, evidence and remaining loading work](auction-loading-and-inventory.md).
- Planning only: [version-aware public catalog cache](auction-catalog-cache-plan.md),
  [combined private bootstrap alternative](auction-bootstrap-response-plan.md),
  [persistent navigation, separate Inventory Page and clearer profile preview/edit
  controls with optional decorative cards](auction-navigation-and-profile-plan.md).
  Do not implement the navigation migration as part of this release. Use the
  [UI feature names](ui-feature-map.md) to distinguish backgrounds, collections,
  inventory, showcases and public/account profiles. Keep Refresh Market until
  automatic pre-entry/return freshness validation exists.

- Auction/profile UI follow-up: centered/tinted controls, shared auction artwork,
  coordinated Showcase loading, value-ranked showcase directory, profile-owned public
  username and configurable bottom-right notifications. Migration 0027 intentionally
  resets old public visibility for explicit username/visibility consent. Full gate
  passed (585 node + 103 browser checks; one node skip); staging released as `d6f0ba1`,
  version `8fac8370-d450-4b78-ab9d-47258a54a6fd`. Live UI/access/artwork checks passed.
  Save a public username in Profile, then explicitly re-enable public visibility.
  Production unchanged. [Details and next UI gaps](auction-ui-follow-up.md).

- Staging includes the application `19bc36e` recovery/community foundation:
  encrypted device recovery, audited read-only management pages, opt-in account
  showcases/unverified auction leaderboard, decoded-art fade-in and confirmed-guest
  warning. Migrations 0025/0026/0027 and feature flags are activated on staging only.
  Original foundation gate: 580 node tests (one skipped), 100 browser journeys. Live public/guest-access
  checks passed; review real signed-in recovery/admin/public-visibility workflows.
  [Exact scope, privacy, costs and remaining hardening](auction-community.md).
- Next admin work: isolated Daily Games diagnostics and reviewed Access & Security
  events/controls. No live answer keys, impersonation, destructive management actions
  or developer-mode activation have been added.
- Accounts remain disabled in production; its account migration, provider credentials,
  native email binding and admin bootstrap require a separate approved rollout.
  The requested owner allowlist is configured on staging and retained privately
  for production activation. Developer-mode UI remains a later staging-only feature.
- Confirm real multi-device game/favorites/import sync, targeted-device revocation,
  recovery and the Administrator badge with the user's staging session.
- Remaining: safe backup import/compare, account email/avatar
  changes and unlinking, cross-device idle refresh, audited role administration,
  privacy/retention and backup disclosures, bounded auth cleanup and rate/budget
  monitoring (including per-account document/device API throttles).
- Before production community launch: public/API throttling and moderation, full-account
  export of public-profile settings, counter/audit retention cleanup and disclosures.
  Server-verified competitive scoring remains separate from the casual community board.
- Plan real-world collection archives and monitoring after account/save reliability;
  current Collectr sync retains only the last import, not every past collection.
  Keep guest data isolated and never blend game holdings with real owned collections.

## Games — price comparison (2026-10-14)

- **Showcase drag-first follow-up (2026-10-16), released to both environments:** retain the 20-card total cap,
  allow duplicate printings, individual-copy inventory tiles, indexed drag reorder,
  solid full-tile drag preview, compact touch-only buttons plus keyboard movement,
  value-tinted showcase panels and shared card-inspection tilt. No additional data
  calls or migrations. Source `1f02ae2` passed 554 node tests (one skipped) and
  80 browser checks. Live staging `c018fc59` passed duplicate drag/reorder, protected
  sales, snapshots, tilt and all four rounds of both auction types. Promoted the
  same build to production `3d07744d`; no repeat production suite, as requested.
  A single production availability request met the existing Cloudflare challenge.
  See [showcase rules](auction-showcase-and-delayed.md).

- **Showcase + delayed investigation (2026-10-16), staging verified:** $15
  half-weight Delayed Gratification in rounds 1–2, reveal two of top five unpriced
  cards two rounds later; Bilgewater/Piltover naming, fixed 10% future fees,
  revealed-only sale value, high-price effects, intro audio and colored warning
  panels. New protected 20-printing showcase with drag/button editing, profile
  statistics and bounded private-wallet-free frozen share links. No DB storage,
  migration, daily replacement or production changes. Source `845d726` pushed;
  staging `d88a6156-73b1-41ea-934e-8842184279b3` verified with 553 node tests,
  79 browser checks and live showcase/delayed/free/paid flows.
  [Decisions, ownership/privacy rules and validation](auction-showcase-and-delayed.md).

- **Investigation scans/direct selection/audio (2026-10-16), staging verified:**
  Small/Large Price Scans, cheaper chase/census/follow-up, one-of-top-three peek,
  direct highlighted-card inspection with persisted timed fallback; rarity-colored
  wording and whole-dollar costs. Three-row, premium-weighted seamless backdrop and
  quiet lock/settlement/count-complete audio. Current NPC information boundary is
  unchanged. Source `6cdf9e1` pushed; staging `6d859e46-df75-41a4-917a-b922f5514afc`
  verified. Gate: 545 node tests and 75 browser checks passed. No migration,
  daily-snapshot replacement or production deploy.
  [Rules, compatibility, sound map and validation](auction-investigations-scans-and-audio.md).

- **Investigation revision + removal of NPC automatic samples (2026-10-16), staging verified:**
  grouped Chase / Special census, combined markers/identity peeks, $8 ordinary
  Common-through-Epic Bulk Valuation, $10 Alt-Art Valuation, stronger $4 Lot Audit,
  explicit target/visibility descriptions and shared guide definitions. Player bid
  history shows only that round's investigation, including legacy cumulative saves.
  NPCs receive no automatic private cards; only public/selected/retained disclosures
  plus the existing prior/public bids. Exact category totals cannot be discounted
  below their disclosed evidence floor. Tests/audit:
  [Investigation revision](auction-investigations-2026-10-16.md).
  Opening medians stay similar but NPC winner losses increase; review human play
  before further balance changes. Source `a7b29e2` pushed; staging version
  `1056c0d3-bdb6-4580-8272-e6e9af5266fa` verified in free/paid auctions, all four
  rounds, settlement/reload/leave, both screen sizes/themes, no extra gameplay
  data calls. Full gate: 537 node tests and 73 Chromium checks passed.
  Production remains on `0ff7aaa`. User authorized GitHub push and staging only;
  no new data calls or D1
  migration. Existing daily snapshots and normal saves remain intact.

- [ ] **Personality-specific NPC insights (proposal only):** pilot one capped,
  seeded, non-priced bonus for Collector/Playset Builder; record source/round and
  disclose earned details at settlement. Do not restore generic free priced
  samples. [Roster proposals, information limits and test gates](auction-npc-personality-information-plan.md).

- **Released to staging and production (2026-10-16), source `0ff7aaa`:** accepted free and
  stronger paid NPC balance alongside the lobby, statistics and inspection
  fixes. Final speculation weights are 14/11/8.5/6% free and 20/18/15/12% paid;
  weaker rivals get broader private random samples, with bounded stronger prior-bid
  influence. [Balance settings and paired trials](auction-npc-balance-2026-10-16.md).
  This supersedes the earlier unchanged/proposed NPC notes below; early Rarity
  Census itself remains unchanged. No extra gameplay requests or ingestion.
  Production promotion also includes the daily games and additive migrations
  0022/0023, verified after deploy with a local export/recovery bookmark saved first.
  Existing staging daily snapshots retained. Full gate: 530 node tests passed, one
  skipped, 72 browser checks, build/lint/typecheck; no new source warnings. Live
  staging and production-version preview passed normal auctions/model parity,
  daily challenges/shares, real artwork effects and Singles/Sealed parity in both
  themes/sizes. Production's custom domain still challenges this automated browser
  (403); zone rules unchanged. This release supersedes the older local-only and
  production-pending status notes below. Human play-testing of the accepted balance
  remains useful. [Release verification](daily-games-and-sharing.md#release).

- **Auction inspection/foil repair (2026-10-16), local only:** card inspection
  dismisses on outside clicks/taps, restores focus, and keeps interior clicks or
  inside-to-outside drags open. Close moves to the shared dialog header's right
  with a red border. Foil now layers above artwork (the old auto-z overlay sat
  under the positioned image); a reflective sweep/texture also appears in
  inspection. $250+ glow is softened and confined to the art frame. $50/$250
  thresholds and hidden-price safeguards are unchanged; reduced motion is static.
  No push, deployment, new pricing-provider calls or database changes. Final full
  gate passed: 529 node tests (one skipped), 72 browser checks, build/lint/typecheck;
  no new warnings. Tests verify actual rendered foil pixels/stacking, static
  reduced motion, hidden-price protection, inside-drag safety, outside click/tap,
  Escape and focus restoration. Real catalog art reviewed in both themes.

- **Auction lobby polish + opening audit (2026-10-16), local only:** remove
  investigation category/disclosure tags, color statistics and inset metrics,
  vary the decorative scrolling lobby/entry art, clarify the highlighted $50 fee,
  show current selling fee/three rivals and extend normal entry to seven seconds.
  NPC bidding remains unchanged. Two batches per type (4,000 auctions total)
  show passive-player R1 NPC buyouts at 26.8% free / 32.1% paid. Four automatic
  private samples and early Rarity Census drive disparate estimates; test those
  information advantages before changing every opening bid. Per-rival means,
  methodology and proposed experiments:
  [Opening audit](auction-opening-audit-2026-10-16.md).
  Final full gate passed: 529 node tests (one skipped), 71 browser journeys,
  build/lint/typecheck; no new warnings. Desktop/mobile dark/light reviewed.
  An opening-only census-from-round-two experiment reduced early NPC buyouts to
  about 20% for both types; runtime balance changes remain proposed, not applied.

- **Daily result sharing + daily Showdown (2026-10-16), staging verified; production pending:**
  spoiler-free emoji/text previews and compact self-reported results links; auction
  links reconstruct five outcomes, spend/fees/profit/reward and top five won cards.
  Daily Showdown has 10 Normal and 10 Hard rounds, independent once/day browser
  attempts, shared frozen UTC snapshots, reload/resume and results grids. Both daily
  games have Games tiles. No per-share records/writes or per-round calls. New
  migrations 0022 and 0023 are applied on staging only. Application `b1c22de`,
  staging `e5b2db5e`; production remains `7a4cbb6` / `c076ac77`.
  Historical manifest requests read existing rows only, never regenerate old days.
  Shared first-use CDN artwork checks exclude broken images before publication;
  today's two staging lineups were backed up and repaired with user approval.
  Complete gate: 528 node tests passed (one skipped), 71 browser checks; live
  10+10 Showdown rounds, five auction settlements/sales/reward, shares and artwork
  passed with no browser errors. Implementation, options, limitations and costs:
  [Daily games and sharing](daily-games-and-sharing.md).

- **Auction progress/challenge changes staged (2026-10-16), production pending:**
  retained canceled-intro drafts, random investigation menus that allow zero-hit
  results, guaranteed eligible Follow-Up, Count/Locate/Value grouping, three/four
  round NPC investigation schedules and browser-local normal-play statistics.
  Daily Challenge: $2,500; 3 free + 2 paid; auto-sell wins after each auction at
  fixed 10% fee; 25% positive profit bonus, no cap; once per browser/UTC date;
  resume until midnight, expire without reward if unfinished. Leaving or failing
  a required entry ends the run. Normal reset preserves the daily attempt.
  Shared date-keyed frozen lineup uses `/api/auction/daily`; migration **0022**
  is applied in staging and pending in production. No new cron, paid provider or
  per-round calls; bounded CDN artwork checks run on shared initialization only.
  Browser-level limit is bypassable until accounts; no secure leaderboard implied.
  Complete gate and live staging snapshot verification passed. See
  `docs/games-auction-house-plan.md` for definitions, costs and deployment order.
  Local full gate passed: 516 node tests passed (one skipped), 68 browser journeys,
  build/lint/typecheck; no new warnings. Daily challenge, statistics and
  investigation screens reviewed in dark/light at phone and desktop widths.


- Guide/entry presentation and collection expansion staged (2026-10-16),
  included in `4529fae` and staging `e5b2db5e`. Seven colored collection types, clue icons, larger guide
  text and clearer rival descriptions. Store Clear-Out favors 71–90 free / 106–130
  paid copies; Curated Binder caps printings at two copies. Existing global size
  limits and requested aggregate rarity targets remain; calibration accounts for
  the larger theme. Five-second scanner-style entry briefing runs alongside artwork
  validation, with Skip Intro, free cancellation and reduced-motion support; no
  fee/timer starts while preparing. Background art is decorative, not the hidden
  lot. No new pricing/API/D1 calls; up to ten cacheable decorative image URLs.
  Details and design alternatives: `docs/games-auction-house-plan.md`.
  Full gate passed: 508 node tests (one skipped), 65 browser journeys, build,
  lint/typecheck; no new warnings. Desktop/mobile dark/light reviewed. Superseded
  by the complete 528-node / 71-browser release gate above; production pending.

- **Release 2026-10-16:** app `7a4cbb6` pushed and deployed to staging `ab294936`,
  then production `c076ac77` after staging passed. Includes all pending auction
  polish, rarity budgets/T1 treatment, two rivals, Auction Guide and larger
  portraits. Staging and production-version-preview free/paid four-round checks
  passed, with zero browser errors/additional gameplay pricing calls. Production's
  custom domain challenges automated requests (HTTP 403); zone security rules were
  not changed. See release details in `docs/games-auction-house-plan.md`. This
  supersedes the earlier local-only/production-pending notes below. Developer mode
  remains plan-only. No migrations or ingestion runs.

- [ ] Developer mode — **plan only**, staging Settings option, default off; no
  production control/payload until accounts and an explicit authorization model
  are approved. Candidate diagnostics cover auctions, catalog/history provenance,
  signals, heatmap/EV inputs, cached eBay matching and performance. Off must add
  zero calls; debug auction progress must be isolated. See
  [Developer mode plan](developer-mode-plan.md). No toggle or infrastructure built.

- Auction Guide and two new rivals released (2026-10-16):
  `/games/riftbound-auction/guide` linked from the lobby; rules,
  collection themes, all active investigations, roster and disjoint per-card
  admission targets derive from game configuration. All T1 Worlds Champion bundle
  cards now share the ultra-rare 0.01% free / 0.02% paid pool regardless of price.
  The Closer gains conviction across rounds; rare Trust Fund Kid appears in 8%
  of new auctions with a 35–80% estimate premium. Neither sees hidden prices.
  Original portraits, offline audit and regression tests added. Existing frozen
  lots/rosters remain intact. Economy audit and verification recorded in
  `docs/games-auction-house-plan.md`; no additional API/database calls or migrations.
  Full local gate passed: 507 node tests (one skipped), 63 browser journeys,
  build/lint/typecheck; no new warnings. Guide desktop/mobile dark/light reviewed.
  Shipped in `7a4cbb6` to staging and production; developer mode remains documentation only.

- Metal/premium-promo reduction implemented locally (2026-10-16), not pushed/deployed.
  User-approved combined Metal/Best Of targets 0.05% free / 0.10% paid per card;
  non-Metal promos above $1,000 use 0.01% / 0.02%. Sub-budgets subtract from `other`
  before set focus/repeats; ordinary rarity targets stay unchanged. NPC catalog
  priors use the same weights, preserving eight saved cohorts. 5,000-seed audit:
  Metal in 2.64% free / 8.94% paid lots, down from earlier 24.15% / 44.60%; other
  $1,000+ promos 0.56% / 1.78%. All 37 Best Of snapshot entries are unpriced/excluded;
  future priced entries share Metal odds. Existing lots/inventory unchanged. Lower
  lot values naturally lower NPC opening medians to $69.47 / $207.98; no speculative
  boost to force older targets. No extra API/database calls or migration. Details:
  `docs/games-auction-house-plan.md`.
  Full local gate passed: 503 node tests (one skipped), 62 browser checks, build,
  lint/typecheck; no new warnings. No commit, push or deployment.

- Auction reveal/exit polish implemented locally (2026-10-16), not pushed/deployed:
  fallback Showcase red borders, price-visible $50 foil / $250 foil+glow, colored
  collection headings, confirmed nonrefundable Leave Auction, and detailed final
  investigation/card popups with mid-auction NPC privacy preserved. Generation and
  bidding unchanged. Promo audit: Metals in 24.15% free / 44.60% paid simulated lots;
  those historical rates are superseded by the approved subgroup budgets above.
  Remaining future decision: promo-targeted clues/Collector priorities. Details:
  `docs/games-auction-house-plan.md`.
  Full local gate passed: 499 node tests (one skipped), 62 browser checks, build,
  lint/typecheck with no new warnings. Desktop/phone dark/light reviewed; opening
  bid simulation is unchanged. Awaiting any future push/deploy authorization.

- Auction rebalance is on staging (2026-10-16), **production promotion pending**:
  application `2c97ad6`, staging `8860d6eb`; production remains `1451236`. Includes
  versioned cheaper/expanded investigations, $8 selectable follow-up, round-4
  Top-Two ($75 free / $125 paid), and uncapped NPC bids. New auctions blend a
  cautious public-catalog rarity/theme expectation into opening estimates, tapering
  at most 10/6/2.5/0% free and 8/5/2/0% paid, further reduced by priced coverage.
  Follow-up calibration: median opening NPC bids $98.52 free / $295.33 paid over
  1,000 simulated auctions each; prior completed bids influence later rounds more,
  but stay bounded and never read current sealed bids/private findings. Frozen
  saves retained; priced clues keep full value and round-one buyout stays 2× the
  highest rival. Future economy decision: loss sharing still rewards passive free
  play (~$3.93 mean rebate), blind paid play can be profitable, and unlimited bids
  allow rare large outliers. Paid's average passive rebate is below its entry fee.
  Do not silently change payout rules. Details: `docs/games-auction-house-plan.md`.
  Full local gate passed: 495 node tests (one skipped), 59 browser checks, build,
  lint and typecheck; no new lint warnings. Live staging free/paid flows, exact
  model/offer parity, persistence and responsive themes passed, zero extra gameplay
  data calls or browser errors. No migration/ingestion/security changes. Release
  record: `docs/games-auction-house-plan.md` (staging only).

- Auction composition update (implemented 2026-10-15, staging 2026-10-16): remove the $2,000 lot cap;
  target free Epic/Alt Art 8%/5% and paid 12%/8%, paid Signature 0.5%, taking the
  increase from Common. Retain themes, copy limits, source prices and old saves.
  2,000-seed production-snapshot simulation: free 7.81%/5.09%, paid 11.76%/7.97%,
  paid Signature 0.51%. Included in staging `2c97ad6`; production still pending. The accompanying investigation
  proposal (cheaper expanded scans, consolidated audits, follow-up inspections and
  round-4 higher-cost Top-Two) is now implemented above, along with removing the
  old NPC bid limit. Full details and
  simulation caveats: `docs/games-auction-house-plan.md` §Uncapped rarity composition.

- Production gameplay verification pending Cloudflare testing access: latest Auction
  House application `1451236` is deployed to staging `469c9ca8` and production
  `60d8c7a5`, including optional 20-second auto advance, Top-Two Valuation, flip and
  investigation cues, promo borders and presentation polish. Full gate passed
  (473 node / 58 browser); live staging verified countdown/cancellation, safe private
  and public finding popups grouped by round, latest-bid rows, reveal controls,
  responsive themes, free/paid auctions, persistence and sales with no extra gameplay
  data calls. Production code/styles/assets match the validated build, but Games
  routes challenge the automated client with HTTP 403. No security changes made.
  Shipped details and superseded staging records: `docs/todo-completed.md` and
  `docs/games-auction-house-plan.md`.

- Future Auction House multiplayer (2026-10-15): **public auctions only** through
  a public lobby / Quick Join; no private rooms, invite-only auctions or join codes.
  Proposed four-seat server-authoritative tables, private clues/sealed bids,
  reconnects and separate multiplayer funds; NPC fill, identity, start rules and
  persistent economy remain decisions. Plan phased rollout, privacy/concurrency
  tests, public-entry abuse controls and measured hosting costs before launch.
  Not implemented; no hosting changes authorized. Full plan:
  `docs/games-auction-house-plan.md` §Future multiplayer.

- Auction design backlog: passive-payout inflation/economy guardrails, NPC
  investigation charges or persistent budgets, challenge progression, structured
  clue menus/menu information leaks and post-auction recaps. Initial bids are now
  deliberately cautious; tune difficulty from playtesting without giving NPCs
  hidden true-value knowledge. Existing NPC information remains free and shared-loss
  rules are unchanged. Details: `docs/games-auction-house-plan.md`.

- Auction House production browser verification remains pending Cloudflare's
  managed challenge (403). Shared-round reveals, revised/rarity investigations,
  calmer NPCs, compact artwork and collection/settlement cleanup shipped from
  `2a3f8da`: staging `1be620f0`, production `e587217f`. Full gate and live staging
  passed; production bundle/CSS match the validated build. No security changes.
  Shipped notes: `docs/todo-completed.md`; rules/costs: `docs/games-auction-house-plan.md`.

- Released Auction compact-grid/settlement follow-up: auto-fill collection columns with a
  140px tile cap, bid-control and participant separators, six settlement metrics
  in both modes (Gross Market Spread removed, free entry explicitly $0), and
  Auction Finished header after settlement. No pricing, save or database changes.
  Pushed `ddac677`; staging `85126f47` and production `9fd0dd82` deployed.
  Full gate: 438 node tests passed, one skipped, 47 browser checks. Live staging
  passed all new UI checks plus auctions/inventory (54-card free / 67-card paid).
  Production bundle/styles match the validated build after brief propagation;
  gameplay testing remains Cloudflare-challenged (403). No security, migration
  or ingestion changes. Details: `docs/games-auction-house-plan.md`.

- Released Auction House balance/layout: free overnumbers/signatures retained at
  80%/50% of selected draws (replacement goes to non-chase stock); unchanged paid
  generation. Both modes use 15% stronger clue-based opening bids only, with the
  same cap/participation/buyout rules. Auction House uses full browser width with
  normal gutters; other game pages stay constrained. No extra pricing/database
  calls. Pushed `1a18fbc`; staging `3e587bd2` and production `903c395c` deployed.
  Full gate: 438 node tests passed, one skipped, 47 browser checks. Staging live
  flow/full width verified (53-card free / 64-card paid); production assets match
  the build, but gameplay checks remain Cloudflare-challenged (403). No security,
  migration or ingestion changes. Measurements: `docs/games-auction-house-plan.md`.

- Released Auction House follow-up: free 25–90 / paid 50–130 random copies,
  shared size validation/copy, stronger matching blue entry pulses, and automatic
  scroll to Auction Settled after the winner announcement (not on each counted card).
  Legacy saved lots remain intact. Pushed `00a4ff1`, deployed staging `a855b6be`
  and production `0a179746`. Full gate: 435 node tests passed, one skipped,
  47 browser checks. Live staging passed (47-card free / 105-card paid); production
  bundle/CSS match the validated build, but page/gameplay checks still receive
  Cloudflare's managed challenge (403). No security, migration or ingestion changes.
  Gross Market Spread removal was subsequently approved and is included in the
  compact-settlement follow-up above.
  Details and unchanged cost boundaries: `docs/games-auction-house-plan.md`.

- Auction entry/inventory polish: automatic failed-artwork exclusion/reroll, text-only
  starting state, generated free/paid entry art, explicit rarity/Sell All controls,
  right-aligned finish and actual named NPC investigations with redacted findings.
  Deployed and verified on staging from `8a6826e`, version `32799d2a` (2026-10-14),
  together with the previously local compact-bid/pulse updates. Full gate: 434 node
  tests passed, one skipped, 47 browser checks. Live 36-card free / 145-card paid
  auctions passed with no extra gameplay pricing calls or browser errors. Production
  unchanged (`04c63e07`); promotion remains pending user request.
  Details: `docs/games-auction-house-plan.md`; art prompts: `docs/auction-entry-artwork.md`.

- Paid-auction/round-control follow-up: $50 entry, larger premium-weighted lots,
  slightly stronger clue-based NPC competition, balanced investigation prices,
  pulsing capitalized entry buttons, compact previous bids with green round leaders,
  bordered round/timer row and no entry skeleton/Jump to Bid. Deployed and verified
  on staging from `9da396a`, version `54eb3aa1` (2026-10-14); production remains on
  `04c63e07`, promotion pending user request. Full gate: 428 node tests passed,
  one skipped, 46 browser checks. Live 73-card free / 136-card paid auctions passed
  with no additional gameplay pricing calls. Rules and artwork-abort notes in the
  auction plan.

- Auction House is deployed to staging and production from `c983e21` (2026-10-14).
  Shipped implementation and economy/lobby changes moved to `docs/todo-completed.md`;
  detailed decisions and staged release history remain in `docs/games-auction-house-plan.md`.
  Follow-up: production browser verification is blocked by Cloudflare's managed
  challenge (HTTP 403, `Cf-Mitigated: challenge`); the new game bundle and artwork
  return 200. Retest after the existing testing-IP exception is reviewed. No security
  rules were changed. Staging live flow and the full release gate passed.
  Review NPC balance and cash inflation from loss-sharing after player testing;
  persistent NPC wallets and multi-auction sessions remain deferred.

- Riftbound Price Showdown is released and verified in production (2026-10-14).
  Shipped features and validation moved to `docs/todo-completed.md`; plan and cost
  boundaries remain in `docs/games-price-game-plan.md`.
- Later: Pokémon tile/pool using the shared game engine; decide language/printing scope.
- Mixed sealed/card rounds remain deferred and opt-in pending product-type/price-band decisions.
- No per-round API calls, sales/history spending or database writes. No public score leaderboard.

## Current priorities (proposed 2026-09-03 — confirm at review)

Everything through P7, waves 12–19 of the refactor program, J2 phase 1, and the R1–R4
ingestion fixes are in production (2026-09-10, Worker version `9f30fee8`). What remains
falls into three tiers:

1. **Standing commitments with dates.** The October model-verification review (Scheduled
   tasks below) is the gate for promoting v2.2; it needs the **model-version stamp in
   `signal_history`** (§P governance TODO) built *before* the promotion, so that stamp is
   the one piece of engineering the calendar forces. Delta Reign (2026-11-06) needs only
   follow-through: regenerate `RELEASE_SETTLE` cells at launch, watch the presale EVEs.
2. **Small, high-value fixes that are unblocked today:** §I.2 view-mode persistence across
   list pages; §I.3 the sealed sale-scenario rework (the panel has been hidden since
   2026-08-28 — a visible hole in scalper mode); §K1 the buy+sell collision treatment
   (needs a "very close" definition first); §L4/§M13 the retailer-exclusive classifier
   audit; §M11 the per-run work-list cache (free tidy-up).
3. **Larger phases, in recommended order:** §L2 One Piece curated chase singles (the one
   catalog expansion that fits the cron budget and unlocks OP import matching); §O2's
   Browse-API listings grid (implemented on `EnhancementTrial`; validated activation pending);
   §I.1 large-grid phone treatment; §J1 sets sort control (after usage data); §M7/§M8
   category registry + game-check widening (do together with the next new game).

Deferred by decision, revisit only on trigger: §L1 JP curated singles (priciest
expansion after MTG), §L3 MTG sealed, §M9/§M10 (pending MTG), §P8 tournament feature
and the character-level cohort rung (both at the December 3-month review), the 90-day /
1-year horizon models (queued behind the 30-day goal), F1(3) per-product summary chunks
(parked pending cold-start numbers), and the deferred research items (character priors,
pull-difficulty adjustments, execution-aware net returns).

## Scheduled tasks

The calendar of record. Dates are absolute; the model-review cadence and refit policy
are defined in `docs/model-gaps.md` → "Review calendar" and "Update policy".

| When | Task | Detail / where |
|---|---|---|
| **First week of October 2026 — THE scheduled task** | Model-verification review, month 1 | Shadow scoreboard (`npm run shadow:scoreboard` on a fresh backup) → first 30-day verdict → **v2.2 promotion decision** (harness verdict + shadow agreement; v1 becomes the reverse shadow); stamp the model version into `signal_history`; sanity-check the ≥20-sales bump and 5/30D liquidity floor on the first ~30 days of real sales data; EVE vs actual for the presale products already served; regime-mix tripwire (~10% Falling / ~41% Overextended baseline); data health (sales fill rate, cohort_stats coverage, ingestion completeness). Plus the tier-1 data refresh: append the month to the archive, rebuild the local DBs, re-validate with frozen parameters. |
| Before that review | Build the model-version stamp | §P governance TODO — prerequisite for a clean promotion; small change to the batch writer + `signal_history`. |
| Late October 2026 (Delta Reign presale → 2026-11-06 release) | Launch follow-through | Regenerate `RELEASE_SETTLE` cells for the launch; confirm ME06 era mapping still resolves; check the Pokémon 30th product line's shape against the validation blocklist when it lists (`docs/model-gaps.md` P7 caveat). |
| First week of November 2026 | Model review, month 2 | Promoted-model live metrics vs backtest bands; Delta Reign day-0/30 EVE vs actual; 90-day horizon feature study (fwd90 deciles) if capacity allows; second sales-data checkpoint; tier-1 data refresh. |
| First week of December 2026 (3-month review) | Model review, month 3 | ~90 days of sales history → empirically recalibrate the liquidity floor and sales bump; first quarterly walk-forward re-run on the extended archive (append-only, same protocol); revisit §P8 tournament feasibility and the character-level cohort rung; tier-1 data refresh. |
| Monthly thereafter (first week) | Model review + tier-1 data refresh | Evaluate always; refit quarterly at most or on triggers (live hit rate below band 4+ weeks; a baseline beating the served model; material regime-mix shift). |
| Quarterly (from March 2027) | Walk-forward re-run; threshold re-tuning only if a trigger fired | Annual: reassess 1-year model viability as independent windows accumulate. |
| Next Cloudflare billing cycle after 2026-08-31 | Confirm the D1 rows-written meter collapsed | M1 delta-only writes should cut history writes ~97%; watch `pointsWritten` in `history-backfill` runs (`docs/ingestion-scaling.md`). |

## Open items index

§I queued visual-pass items · §J sets view · §K signal display · §L catalog coverage
gaps · §M ingestion scaling (M7–M13 open; M1–M6 shipped) · §O monetization · §P
signal-model program (P8 + governance TODOs; P1–P7 shipped — see the completed doc) · §Q
code-review follow-ups (Q1–Q5 and Q8 open; Q6/Q7/Q9 shipped in part) · §R production
ingestion (R4 fix 3, R5, R6 activation, and R7 open; R1–R3 shipped — see the completed doc) · §S crawler and
bot traffic (S2 measurement due).

## I. Queued from the staging visual pass (2026-08-28)

Deferred to a later phase at the user's direction:

1. **Large image view on mobile** — the large-card grid needs a real phone treatment, and
   the tap model currently conflicts: tapping a tile is expected to both reveal the history
   popup and navigate to the single card/sealed detail page. Decide one tap model (e.g.
   first tap = popup, explicit control = navigate) and apply it consistently.
   **Tap model decided 2026-09-01 → planned as §N1** (tap = popup toggle, explicit
   "View card" button in the popup navigates); the large-grid phone treatment itself
   stays queued here.
2. **View mode persists across list pages** — switching between Leaderboard / Hot Buys /
   Hot Sells and Singles/Sealed should keep the selected view mode (large/medium/text/full)
   instead of resetting per surface. Likely a localStorage device preference layered under
   the URL param (an explicit URL view still wins on shared links).
3. **Sealed-detail sale scenario rework** (panel hidden 2026-08-28 pending this): move the
   Sale Scenario section down to sit directly above the "Product overview" (Product
   Details) section; render it **only in scalper mode**; and let a **purchase price be
   entered manually** to replace the MSRP-derived total cost in the profit math.

## J. Sets view backlog (added 2026-08-29)

**J1. Sort control on `/sets` (user-deferred at planning, 2026-08-29).** A control on the
sets browse page reordering set tiles WITHIN their era/category groups by release date
(default), 30D momentum, or tracked value — groups keep their order, tiles re-rank
inside them, so "which Scarlet & Violet set is moving" is answerable without scanning.
Excluded from the initial build; revisit after the browse page has real usage.

**J2. "Where the value sits" — per-rarity pack value breakdown (phase 1 shipped 2026-09-05, `d7de3b9`; phase 2 open).**
2026-09-17 local implementation: source-backed profiles for 198 catalog sets, 24 set-specific
odds overlays, corrected replacement/Signature math, ordinary-printing aggregate versioning,
and the shared set/sealed breakdown panel. See `docs/pack-profiles-2026-09.md` for activation
and research gaps. Deployment, the MSRP slider and custom rates remain outstanding.
Replace the single Pack EV number with a per-rarity breakdown for every market: per-pack
value and share bar per rarity, CHASE badges, "chase prints are X% of EV", a purchase-price
slider from MSRP to market, and the bulk tiers valued from a new `set_rarity_stats`
aggregate the live ingestion can write from the TCGCSV group files it already downloads
(commons/uncommons need no catalog rows). Pack composition (`perPack`) joins `packsPerHit`
in `pull-rates.json`, curated only. Plan, model, costs, and phases:
`docs/set-value-breakdown-plan-2026-09.md`. Phase 1 — the `set_rarity_stats` aggregate
(migration 0017), the breakdown model, and `perPack` tables with Pokémon era defaults — is in
production; no page renders it yet. Phase 2 (panel, MSRP↔market slider, optional custom rates)
needs a packs-per-product table and per-pack MSRP where the pack product has none.

**J3. Pokémon + Riftbound set × rarity heatmap (daily snapshot live in production 2026-10-14).**
Work branch: `feature/set-rarity-heatmap`. The Sets toggle, URL controls, D1 read,
aggregate payload, source-date-aware calculations, and browser/unit fixtures are live in
production. Tiles remain default and do not call the heatmap endpoint. User decisions (2026-10-09): Sets-page
toggle with tiles default; median card-price change; show 1–2-card cells with a small-sample
warning. The first follow-up lowered required coverage from 60% to 5%, and changed
the default window from 30D to 7D without substituting 7D
returns into 30D/90D cells. The source-date audit chose at most two days
for a member's latest price and at most three days between the requested cutoff and its
baseline. The daily D1 snapshot implementation below is deployed and migrated in
both staging and production, replacing the slow on-demand history scan.
The 2026-10-14 staging release limits Riftbound heatmap rows to the five main expansions
(Origins, Spiritforged, Unleashed, Vendetta, Radiance) and raises the gate to 7%;
it does not remove promo, event, or bundle products from the catalog or Sets tiles.
The Pokémon follow-up offers an optional URL-backed series grouping (Mega Evolution,
Scarlet & Violet, etc.; flat rows remain the default) and folds the nine TCGCSV
Gallery/Vault/Radiant Collection subsets into their parent expansion's member-level
median and coverage. The page discloses the fold, and matching-card drill-down includes
all original catalog set names. No Pokémon promo/deck filtering is applied yet; the
provisional expansion-only classification needs a separate reviewed decision.
Production now uses the same 7% policy and version-4 snapshot as staging. Staging's snapshot was regenerated on
2026-10-14 from the 2026-10-13 catalog: 196 Pokémon rows and five Riftbound rows,
including all nine folded Pokémon parents. The public API returned 200 in about
0.56 seconds for 687,491 bytes; live browser checks confirmed series grouping,
combined subset links, and desktop/mobile rendering. Staging remains cron-less.
Production deployment and migration 0020 completed on 2026-10-14 after a database
export and recovery bookmark. Its initial snapshot has the same 201 rows dated
2026-10-13; the same writer was invoked directly while the guard cron continued
routine detail enrichment. Production-version browser checks passed for series
grouping, subset links, and desktop/mobile rendering; the API returned 200.
The custom domain initially challenged the automated browser, so the first checks
used the existing version URL with production bindings. Security Events identified
ordinary Bot Fight Mode. The user then added a site-scoped IP Access Allow rule for
the observed IPv6 address; direct `rawsignal.cards` checks returned 200 and passed
on 2026-10-14, including series grouping, nine folded subsets and card links, five
Riftbound expansions, the 7% gate, and desktop/mobile controls. The working setup
and troubleshooting procedure are documented in
[Cloudflare automated testing](cloudflare-cutover.md#cloudflare-exceptions-for-automated-testing).
Add a market-movement matrix inspired by the
[ShizuTCG Riftbound index](https://tcg-price-tracker.shizukaziye.workers.dev/rb-index#set=ALL&tier=ALL&w=rarity&m=index).
Reference inspection: the public HTML/rendering code exposes a "Set × tier heat map",
7D/30D/90D controls (30D default), signed percentage cells, empty cells, and cell selection
that scopes the set/tier view. Its values depend on the selected index/box-value methodology.
The reference browser was unavailable during research; rendered desktop/mobile behavior still needs
visual comparison. Borrow the matrix and drill-down interaction, not its styling, code,
pull-rate assumptions, or volume-weighted model. The first heatmap release is live;
the daily-snapshot change is also live in production.

Proposed product scope and UX:

- [x] Add a **Heatmap** view alongside the existing tiles on `/sets`; preserve the default
  tile view. Support Pokémon and Riftbound as separate game-scoped matrices (All shows
  two sections, never mixes their tiers). One Piece and sealed-product-type heatmaps are
  outside this first release. A set row describes its tracked **singles**, not sealed EV.
- [x] Rows are sets, columns are game-specific rarity/tier groups plus **All tracked**.
  Reuse the existing catalog section/rarity registry, with an explicit mapping rather than
  assuming Pokémon and Riftbound labels match. Pokémon should retain meaningful modern
  and vintage tiers; Riftbound should distinguish Epic, Alt art/Showcase, Overnumbered,
  Signature and eligible promos. Preserve the catalog's token/basic-rune/ordinary-promo
  exclusions and keep language/printing identities separate. Unpriced Metal/Best Of and
  foreign-exclusive promos remain discoverable with unavailable values.
- [x] Controls: game, 7D/30D/90D (7D default after the 2026-10-09 follow-up), set search, existing era/category and
  favorite scope; newest-first set order with optional change sorting. Scope changes and
  selected cell round-trip through `app/state/sets-query.ts` and browser Back/Forward.
  Keep multi-filter Apply/Close behavior consistent with existing filter primitives.
- [x] Each cell shows a signed percent, green/red intensity around a neutral zero, and a
  visible legend. Use a fixed symmetric scale per window, shared across both games;
  clamp only the color intensity, never the displayed percentage. `N/A` is visually
  distinct from 0%. Choose the scale from representative data before implementation.
- [x] Click/tap/keyboard activation selects the cell and opens an in-flow summary below
  the matrix: set, tier, window, method, eligible/total tracked counts, source date,
  coverage warnings, and explicit **View matching cards** / **View set** links. Selection
  must not unexpectedly navigate or scroll to the page top; include Clear selection.
  Reuse catalog URL serialization for the card link; validate tier-to-filter parity.
- [x] Desktop: semantic table with sticky set labels and horizontally scrollable tier
  columns. Mobile: preserve readable/tappable cells, sticky row labels and a visible
  horizontal-scroll hint; allow narrowing to one tier without shrinking the whole table.
  Support focus-visible, descriptive accessible names, non-color sign labels, reduced
  motion, dark/light themes, and the existing surface/typography/movement tokens.

Data definition and correctness gates:

- [x] MVP cell = **median percentage price change of eligible tracked printings** in that
  game/set/tier. Label it "Median tracked-card change", not a market-cap index, full-set
  return, sales volume, pack EV, or investment return. Compute **All tracked** from the
  underlying eligible members, not the average of tier medians. Use the same member-level
  calculation for both games; document that this intentionally differs from the reference.
- [x] Audit `db/sets-service.ts` and `market_metrics` before reuse: exact product + printing
  + condition joins (not the existing permissive sealed join), unique members, dated
  7/30/90-day cutoffs at or before the target date, and no newly listed/missing-price card
  contributing a synthetic zero. Reuse `core/domain/history-metrics.ts` for the cutoff
  contract; any stricter freshness gate is heatmap-specific, not a silent signal change.
- [x] Publish eligible/total tracked counts per cell, with "tracked catalog, not the full
  checklist" disclosure. Revised gate (2026-10-09): at least one eligible member and
  5% coverage. Compute the median only from valid member comparisons, retain the full
  tracked count for provenance, and visibly flag 1–2 eligible members.
  Below 5% remains `N/A` with a reason. A tier absent from a set is "Not applicable",
  not "No price history".
  New sets without a window's history remain unavailable for that window.
- [x] Audit endpoint freshness and the §R5 split-source-date issue before enabling 7D/30D/
  90D returns. Use published source dates, never response `generatedAt`, to describe
  freshness; define and test permitted endpoint age and cutoff gaps against daily-source
  cadence. Historical member coverage and current coverage must both be sufficient.
- [ ] The 2026-09-28 production audit found the last successful scheduled TCGplayer
  history run at **2026-09-18 03:53 UTC**; subsequent recorded runs failed, while sampled
  TCGCSV daily prices continued through September 28. Price-only heatmaps need not wait
  for daily sales-volume access, but must validate the actual dated price inputs.
  Do not consume stale `sales_7`/`sales_30`, add volume weighting, or treat the general
  metrics update timestamp as sales freshness. Daily volume remains a separate feature.

Implementation sequence and cost boundary:

1. **Data audit + fixtures:** establish tier mapping, denominators, freshness/coverage
   gates, join uniqueness, and agreement with known member returns. Inspect query plans
   and record baseline D1 rows read; avoid a per-cell history/API fan-out.
2. **Shared model + aggregate payload:** pure heatmap types/aggregation in `core/domain/`,
   one bounded game/set/tier aggregate read in `db/sets-service.ts` (or an adjacent shared
   service), published-run-aware caching, and a compact payload containing all three
   windows. Reuse stored prices/metrics; **zero additional upstream/provider calls**.
   Do not send complete card histories to render the matrix. Window changes and cell
   selection should operate on the loaded aggregate payload.
3. **UI + drill-down:** shared `SetHeatmap` composed into `app/SetsView.tsx`, URL state in
   `app/state/sets-query.ts`, and rules in the owning sets stylesheet. Use existing set
   details and catalog routes rather than a second index app or new chart dependency.
4. **Daily snapshot (staging deployed 2026-10-09; production deployed 2026-10-14):** an uncached staging read took
   ~11 seconds for 218 sets / 742 KB, while the older local max-profile scan took ~9 seconds.
   `drizzle/0020_set_heatmap_snapshots.sql` adds two bounded rows, one per game. The existing
   guard cron calculates once after each published live run and metrics rollup, before history;
   the API then reads only the saved rows. Staging remains cron-less and can run the protected
   `heatmap` ops job deliberately. Snapshot writes replace both game rows in one D1 batch;
   the current read remains explicitly source-dated. No new upstream API calls or per-cell
   queries are added. Production D1 rows-read and p95 latency remain unmeasured; confirm
   them after an authorized deploy and migration before claiming a monthly cost saving.
   The paused sales-table SQL moved outside the active migration chain so applying 0020 for
   the heatmap does not activate or create sales summaries. Staging migration 0020 and the
   protected job produced a 218-set snapshot dated 2026-10-08. A fresh edge-miss API read
   took about 0.35 seconds for 742,660 bytes. At the 5% gate, 7D set totals were available
   for 204/205 Pokémon and 11/13 Riftbound sets; 30D for 189/205 and 5/13; 90D for none.
   This is a staging observation, not a production p95 or billing measurement.
   The 2026-10-08 source-dated staging snapshot had 13 Riftbound groups, of which
   five are main expansions. For these five, 7D set-wide comparisons were complete
   for Origins, Spiritforged, Unleashed, and Vendetta; Radiance had no usable history.
   Their 30D coverage was 8.7%, 10.4%, 10.6%, and 11.4% respectively. Raising
   the gate to 7% preserves these four set-wide 30D medians, while suppressing one
   sparse rarity cell; 90D still has no usable cells. Removing unrelated set rows
   does not increase coverage within any retained set.
5. **Coverage investigation:** the October 9 live payload showed no Riftbound set clearing
   60% 30D coverage, and no game clearing 90D set coverage. Vendetta had only 21/236
   usable 30D member returns. New Riftbound cards lack a 30-day baseline; absent older
   observations also suppress 90D values. An older local database seeded with archive
   history yielded 6/7 Riftbound 30D and 5/7 90D set totals, so precomputation fixes load
   latency, not missing observations. The follow-up lowers the display gate to 5% with
   explicit limited-coverage warnings and makes 7D the default; it does not create missing
   30D/90D observations or manufacture returns. Verify and backfill authorized dated price
   history separately.
6. **Release gate:** tests for medians, All-tracked weighting, null vs zero, small cohorts,
   stale/cutoff gaps, duplicate printings, cross-game same-name sets, promo/language
   boundaries, and URL round-trips. Browser checks cover Pokémon/Riftbound, desktop/mobile,
   keyboard/touch, dark/light, empty states, filtered card links and unchanged tiles.
   Run `npm run check` when implementing; commit/push/deploy only when requested.

Deferred: rarity/supply-weighted indexes and per-pack/per-box EV heatmaps (depend on curated
historical composition/odds and a separate methodology decision), daily/1D movement until
source-date consistency is verified, sales-volume weighting, and broader game/sealed scope.

## K. Signal display (added 2026-08-30)

**K1. Handle a card/sealed product that carries a Hot Buy and a Hot Sell signal at once
(added 2026-08-30).** When a product qualifies for *both* boards at the same strictness —
its price sits close to both its 30-day low and its 30-day high, i.e. a tight recent range
with conflicting momentum — the current UI would show whichever side the surface asked for
(e.g. the import table's Hold lens shows the buy, the Hot Sells lens shows the sell) and the
two never reconcile. Decide and build a distinct treatment for this collision: e.g. a
combined "Conflicted / range-bound" badge, showing both sides side by side, or a tie-break
rule (stronger score wins, with the loser noted). Applies anywhere signals render — the
Collectr import table, the Hot Buy/Hot Sell boards, and single-card / sealed detail pages.
Needs a definition of "very close together" (score delta and/or distance-to-cutoff
threshold) before implementation.

## L. Catalog coverage gaps (surfaced by the Collectr import, 2026-08-31)

2026-09-18 local implementation: Riftbound `metal-promos` includes priced and unpriced
Metal / Best Of / Prize Wall printings. Null prices stay unavailable; eBay access and
affiliate links remain active with strict promo-treatment matching. Scoped fallback
refresh: 717 Riftbound cards, including 68 metal promos (47 without market prices).
No production deployment yet; after release the next live walk adds the D1 records.
Follow-up local expansion: 1,333 Riftbound cards after the user's explicit exclusions,
including English commons/uncommons, collectible promos, alt-art runes and Lunar
Irelia (Simplified Chinese). 169 catalog cards excluded by policy; details and source
limitations in `docs/riftbound-coverage-2026-09.md`. Still not deployed.

2026-10-14 shipped artwork follow-up: all 68 Metal / Best Of / Prize Wall printings
use the regular-rarity image of the matching card (40 name-and-number identities,
including four Proving Grounds Starter cards). Shared normalization and read-side
resolution cover existing D1 records, feed-backed lists/details and saved buylists
without a migration or extra data calls. Product IDs, treatments, prices and eBay
queries remain unchanged. Unknown future matches retain the original source image.
Artwork change is live in staging and production. Source details are in
`docs/data-sources.md`; release evidence is in `docs/todo-completed.md`.

Diagnosed from the @srikaskrr test import: several unmatched items are real products we
simply don't ingest. Matching is a TCGplayer product-id join, and a **name fallback now
runs on the showcase path too** (commit adding sealed/singles name-fallback), which catches
items we hold under a different id — but it can only match against catalogs we actually
ingest. These are ingestion-scope gaps to close (each is a TCGCSV category we don't pull):

**L1. Japanese sealed Pokémon — MEASURED 2026-08-31, option B IMPLEMENTED.** We tracked
**zero** JP sealed (all ~2,692 Pokémon sealed rows were English ids); JP *singles* are
tracked only as the 22 promo groups of category 85 (~1,184 priced "Japanese Promos").
Collectr lists JP boxes under its own synthetic ids (10,000,000+), but they DO exist on
TCGplayer category 85 — e.g. **Eevee Heroes Booster Box = TCGplayer 565351** (S6a,
publishedOn 2021-05-28); VSTAR Universe (S12a 2022), Shiny Treasure ex (SV4a 2023),
Pokémon 151 JP (SV2a 2023). Measured: category 85 has 456 groups (434 non-promo ≈
18,500 products) but only **~254 sealed products (~224 priced, 1.4% yield)** — each JP
set carries just booster box/pack + occasional premium trainer box. Tick cost scales
with group count, not products, so the options were: A) full 434-group walk = +868
req/day, +~41 cron ticks for ~254 keeps; **B) modern cutoff publishedOn ≥ 2020 (140
groups, SWSH era on — covers every Collectr miss) = +280 req/day, +~15 ticks, ~150–180
sealed — CHOSEN**; C) sealed-group cache (~+11 ticks, full coverage, new plumbing) —
available later if completeness matters. JP sealed stays `game:"pokemon"` (no
migration) and joins the English Pokémon sealed catalog/feed. JP promo groups remain
singles-only (their ~6 sealed-shaped items stay out, unchanged). Full JP singles
(~15,800 priced) would exceed the entire current singles catalog and blow the cron
budget (+~263 history ticks — infeasible); curated JP chase rarities (AR/SAR/SR/UR,
~3–4k records, +~80–105 ticks/day) is the only viable singles shape — unscheduled, and
the priciest expansion on the board after MTG.

**L2. One Piece — full sealed + singles. Sealed APPROVED 2026-08-31; singles deferred
to its own phase.** OP sealed is only ~23 curated products today; the main English OP
**booster boxes** are missing (e.g. "Carrying On His Will Booster Box" = TCGplayer 628352).
Measured (see `docs/sealed-market-expansion.md`): cat 68 = 87 groups, 7,518 products,
~420 sealed → +174 TCGCSV requests/day, +~400 history calls/day, +~15 cron ticks, **no
migration** (the game check and onepiece⇒sealed check already fit). Plan: `sealedOnly`
work entries in the live walk + `isOnePieceSealedProduct` normalizer + Bandai-derived
MSRP table + full `sealed-onepiece.json` sync; downstream (SealedGame union, metrics
index, sealed-page scope, Collectr import matching) is already plumbed.
OP **singles** are still untracked (0 rows) — promos/parallels like Monkey.D.Luffy
OP05-060 (557296), Boa Hancock OP07-038 (623618), Otama OP07-022 (545804) can never
match. Fetch cost of singles is zero (same group payloads), but all singles = +7,100
records and +~210 cron ticks/day (near the 720 cap) plus a catalog_products table
rebuild (drop the onepiece⇒sealed check) and a full new singles market surface (rarity
taxonomy, sections, market tab, enrichment, metrics, signals).
**Singles plan of record (decided 2026-08-31): curated chase-rarity sections** — Alt
Art / Manga / SEC / SP / parallels only (~1.5–2.5k records, +~50–80 ticks/day), the same
section model Pokémon singles use. Scheduled as its own phase; not started.
*Sealed IMPLEMENTED 2026-08-31:* category-68 `tcgcsv-sealed` walk entries in
`db/live-ingestion.ts` (sealed-only, singles never normalized), `isOnePieceSealedProduct`
+ `normalizeOnePieceProductType`/`normalizeOnePieceSealedProduct`, curated Bandai MSRPs
migrated to `verifiedMsrp["onepiece:*"]`, full generated `sealed-onepiece.json` via
`npm run data:sync:sealed:onepiece` (420 products, 348 priced, replaces the curated 23).

**L3. Magic: The Gathering sealed — DEFERRED 2026-08-31 (usage cost).** No MTG game is
tracked. Collectr users hold MTG sealed — e.g. "Universes Beyond: FINAL FANTASY – Gift
Bundle" (618899). Measured plan (full numbers in `docs/sealed-market-expansion.md`):
cat 1 = 455 groups, ~178k products, only ~2,450 sealed (1.4% yield) → a daily
sealed-only walk costs +910 TCGCSV requests, ~150–200 MB JSON downloaded (99% discarded
singles), +~2,300 TCGplayer history calls, +~77 cron ticks — ~6× the One Piece cost.
User call: too much usage for now. If revived: (a) migration required — the
`catalog_products_game_check` blocks 'mtg', SQLite CHECK change = table rebuild, add an
mtg⇒sealed check; (b) MSRP stays null (WotC abolished MSRP in 2019) except curated
verified entries (Secret Lair, pre-2019); (c) cost levers — sealed-group cache (after
one discovery walk, re-walk only groups holding ≥1 sealed + newly published groups,
~30–40% savings) or a weekly walk; a modern-only cutoff barely helps (303/455 groups
are 2015+); (d) everything else rides the OP `sealedOnly` rails.

**L4. Retailer-exclusive Pokémon sealed gaps.** Some real TCGplayer SKUs aren't in our
catalog even for English — e.g. "Costco Prismatic Evolutions 8-Pack Mini Tins" (653892).
Audit whether our sealed ingestion is dropping retailer exclusives (Costco/Sam's/Dollar
General variants) or just missing recent additions.

## M. Ingestion scaling & cost fixes (researched 2026-08-31)

Full research in `docs/ingestion-scaling.md` (capacity model, Cloudflare billing
analysis, TCGCSV bulk-archive evaluation). Constraints in one line: the cron has
~200 spare ticks/day (fits ONE more expansion), the daily history job is a permanent
per-product tax, and D1 **rows written** is the only billing meter near its included
limit (~61M projected vs 50M — ~$11/cycle) because history re-upserts ~90–150
unchanged points per product nightly. Each item below is a proposal awaiting a call unless its row carries a RELEASED/LIVE/EXECUTED status (M1–M6 shipped 2026-08-31 → 09-01).

| # | Fix | Effort | Why |
|---|---|---|---|
| M1 | **RELEASED 2026-08-31 — Delta-only history writes** — persist only points newer than the stored max observed_date | S–M | cuts D1 writes ~97%; removes the only projected overage; bill stays $5 at any catalog size |
| M2 | **LIVE since the 2026-08-31 release — Cron `*/2` → `*/1`** | XS | doubles tick budget to 1,440/day; verified $0 (requests/reads/CPU all ≪ included) |
| M6 | **EXECUTED 2026-09-01** — 279,945 archive observations for 574 OP/JP sealed loaded to production; `index:onepiece-sealed` now draws 191 days; details in `docs/ingestion-scaling.md` | — | archive cache kept for a cat-3/89 extension |
| M3 | **RELEASED 2026-08-31 — Sealed-only groupFetchCap 12 → 40** | XS | sealed groups yield ~1 record; ~3× sealed-walk speed at ~80 of 1,000 allowed subrequests |
| M4 | **RELEASED 2026-09-01 — Tiered history cadence** — hot/liquid daily, long tail every 3–7 days; the cron self-starts the daily run | M | catalog can ~3× without the history tax tripling; our own daily observations already capture the close |
| M5 | **RELEASED 2026-09-01 — History targets from D1** instead of deploy-time bundled feeds | M | expansions stop requiring sync-script regen; coverage tracks the walk automatically |
| M7 | **Category registry** shared by walk + sync scripts + tests | M | next game becomes a config entry + normalizer instead of a five-file change |
| M8 | **Widen the `catalog_products` game CHECK once** (mtg/yugioh/lorcana) | S | batches the per-game SQLite table-rebuild migration tax |
| M9 | **Sealed-group cache** — re-walk only groups containing sealed + new groups | M | ~30–40% off sealed walks; build only if MTG revives |
| M10 | **Archive-based daily bulk ingestion** (external job → D1/R2) | L | only at MTG-singles scale; archive is prices-only and can't decompress in a Worker |
| M11 | **Cache buildWorkList per run** — group indexes currently re-fetched every tick | XS | drops ~1,250 pointless requests/day (free, but tidy) |
| M12 | **Rejected-stats review report** — surface the walk's per-run rejection reasons | S | catches taxonomy drift; data already recorded, nobody reads it |
| M13 | **§L4 classifier audit** — why Costco PE 8-Pack Mini Tins (653892) misses while the Costco 151 bundle lands | S | likely a name-pattern miss, not an ingestion-scope gap |

**Recommended order:** M1 → M2+M3 (after which OP curated singles AND MTG sealed
both fit) → M4+M5 before the next singles expansion → M7+M8 with the next new game
→ M6 when sealed chart depth matters → M9/M10 parked pending MTG.

## O. Monetization & marketplace integration (added 2026-09-01, unplanned)

**O2. eBay product links and integration.** Surface eBay alongside TCGplayer on
product detail pages (and possibly rows): at minimum a search-style outbound link like
the existing PriceCharting button (no API needed); deeper integration could use the
eBay Browse/Finding APIs for live listings or sold-comps pricing next to the TCGplayer
market price (API keys, rate limits, and a caching/ingestion path to size at review —
sold-comps would be a genuinely differentiating data source but is the expensive half).
Plan the link tier first; the API tier is its own phase.
*Planned 2026-09-04 — `docs/ebay-integration-plan-2026-09.md`: tier A links (no API, 0 D1
reads), tier B affiliate tags, tier C Browse-API active-listing rotation (`ebay_listings`,
≤ 1,500 calls/day, +1 row per detail view and per first hover reveal), tier D sold comps via
the PokemonPriceTracker tier. eBay sold data itself is closed to us (Marketplace Insights is
a limited release; the public sold search went behind a login in late August 2026).*
*Implemented 2026-09-05 (`d7de3b9`, production `ea6fdbaf`): the initial `ebay_listings`
snapshot table, Browse client, detail panel, manual ops rotation, hero/search/sold links,
and the separate PokemonPriceTracker raw-sale display. Tier B affiliate tagging shipped
2026-09-09 under O1 (completed doc). The original daily catalog rotation is superseded: a
multi-day sweep does not satisfy eBay's six-hour freshness rule.*

*Implementation begun 2026-09-10 on `EnhancementTrial`: plan option A now uses a lazy
`/api/ebay/listings` request on card and sealed detail pages, a six-hour D1 snapshot, an
atomic 4,000-call daily interactive budget, a per-product request lease, and a responsive
image grid. The same first Browse page reviews and retains up to 100 cards and paginates locally at five
per desktop page or three per mobile page; changing pages spends no eBay calls. Production
cron no longer dispatches eBay. Migration 0018 and the Worker secrets are live in production.
The hover asks tile
remains a later enhancement; `ebay-listings` does not belong in the page publish signature
because the no-store client island is independent of the cached page.*
*Account-deletion compliance implemented and activated the same day:
`/api/ebay/account-deletion` handles the endpoint challenge and validates signed deletion
notifications against eBay's one-hour-cached ECC public key. The production verification-token
secret, exact-path Cloudflare managed-challenge exception, endpoint registration, and eBay test
notification were completed successfully.*

*Expanded 2026-09-10 on `EnhancementTrial`: stronger local identity matching rejects
graded/bulk/proxy/cross-game/wrong-language/collector-number and sealed-type conflicts;
the cached cards expose delivered totals, Best Offer, seller trust, watcher/listing-age and
match-confidence metadata with local filters and sorts. Migration 0019 adds one compact
active-ask history row per product/day and the detail panel shows 7/30-day delivered-ask
movement, matched-supply movement, and sampled arrivals/disappearances/price cuts. These are
active-market observations, not completed sales.*

**O4. Remove PokemonPriceTracker.** Do not upgrade the provider tier. Retire its graded and
raw completed-sale path in rollback-safe phases: remove presentation/reads, stop scheduled
collection and its secret, then remove the bundled fallback and finally drop the D1 table
after a production soak. Active eBay Browse asks are not a replacement for completed sales.
Plan and acceptance gate: `docs/pokemonpricetracker-removal-plan-2026-09.md`.

**O5. eBay completed-sales market (future; blocked on licensed data access).** Revisit only
if eBay grants Marketplace Insights access or Raw Signal adopts another licensed source of
item-level eBay completed sales. The ordinary Browse API returns active listings and cannot
power this feature. Marketplace Insights is currently restricted and closed to new users;
its documented history window is up to 90 days.

First release: add a clearly separate "eBay Sold Market" panel with 30-day median sold
price, most recent sold price/date, matched sold-listing count, 30-day low/high, 7/30/90-day
median changes, weekly sales cadence, days since last matched sale, and a robust price spread
(25th–75th percentile or median absolute deviation). Join that data to the existing active
listing snapshot for an explicitly labelled active-ask-to-sold-median gap and a TCGplayer-
market-to-eBay-sold-median gap. Below the metrics, show recent matched sales five per desktop
page and three per mobile page with image, title, sold price, date, condition, buying format,
and seller feedback when the licensed response supplies them.

Keep raw, graded, language, printing, product variant, and sealed case/unit markets separate;
reuse the category/language/condition matching rules and record match confidence, source
timestamp, window, and sample size. Do not label deduplicated sold records as unit volume,
derive a sell-through rate or days-of-supply figure, claim an accepted Best Offer discount,
include shipping in sold price unless supplied, blend raw with graded, or estimate sales from
active asks. This feature must not enter modeled fair value or signals without a separate,
explicit model decision and backtest.

**O6. eBay active-market next release (recommended).** Let the daily history accumulate and
measure real payload/storage/quota behavior before widening the surface. Recommended order:

1. Add a compact 30/90-day active-ask chart to detail pages, using only the stored daily
   aggregates and clearly separating item ask, shown delivered ask, and matched supply.
2. Add cache-only eBay availability/ask badges to board rows or history popovers through one
   batch read endpoint. Those surfaces must never trigger Browse refreshes.
3. Add operator diagnostics for accepted/rejected match reasons, confidence distribution,
   API-budget consumption, refresh coverage, response size, and history-write failures; use
   the evidence to tune matching and decide whether 100 should remain the cap.
4. Add scheduled retention cleanup for observations older than the published history window,
   and document the measured D1 footprint before increasing retention or sampling.
5. Consider ending-soon and country filters after measuring how often eBay supplies those
   fields. Do not infer sell-through, days of supply, or sales from active asks.

## P. Signal-model evolution (planned 2026-09-01; from docs/buy-sell-estimation-research.md §15)

Source research: `docs/buy-sell-estimation-research.md` (baseline-revised 2026-09-01;
original lives in `Documents\Test Project\docs`). Decisions taken at planning: **harness
first**; **full regime labels** (boards + detail, with board filters); **production gate:
every scoring change must beat the current model and the simple baselines out of sample
on the harness** (staging previews allowed earlier); the detail panel keeps the
**"Modeled Fair Value"** name (doc terminology rule amended).

**Gated middle model (adopted 2026-09-01 follow-up).** The archive spans one market
regime (Feb 2024→now, broadly rising), which cannot calibrate the research's ~6
continuous weights per side without overfitting; weighted terms also renormalize
messily when inputs are missing and churn every score on day one. So new intelligence
lands as **gates and one-tier confidence modifiers** (~4 thresholds, each 1-D-sweepable
on the harness and independently measurable), the current score core (proximity + swing
+ confidence) stays, and the §5 weighted blend is demoted to a **contingent v3** —
adopted term-by-term only if the harness shows the gated model leaving measurable
precision on the table.

**Lifecycle weighting findings (research §§6–10, follow-up analysis).** For the
established, board-eligible cards signals actually score (liquidity floor ⇒ mature
history), pull rates/pack costs, sealed prices, same-character comparisons, and the
cohort *level/center* all get **~0 score weight** — their information is already in the
card's own price, and adding them re-counts it (§6.5 endogeneity loop: chase demand →
sealed price → pull cost → card price). They live on as display/context (buy-vs-open
pull-cost comparison, Cohort Position, Rarity Market Index) and as **new-card priors**
for the Early Value Estimate (shipped as P7; cohort median as the anchor — the
Overnumbered cohort clusters near $100 regardless of pull rates, i.e. within-cohort
pull-difficulty β ≈ 0, which the harness can confirm; character premium starts 20–25%
and tapers to ~0–3% by 60 observations; a character/icon field does not exist in the
catalog and is a Phase-4 data-foundation task). One earned v3 candidate: extreme cohort
band deviation (below the cohort's ~10th percentile AND stabilizing) as an extra Hot
Buy evidence line — price-only, backtestable.

Architecture note: `evaluateMarketSignal` is the single scoring path for the batch
writer (`db/daily-ingestion.ts` → `market_signals`), the detail signal panel, and row
badges. P2 introduces an optional `SignalContext` parameter (liquidity, cohort return,
set/game index return, breadth, sales trend — all optional, absence = neutral) so every
surface shares one implementation (landed in P2, which also fixed the detail panel
evaluating without liquidity — see `docs/todo-completed.md` §P).

**P8 (future, separate feature). Riftbound tournament-driven predictions.** Riftbound's
market is player-driven where Pokémon's is collector-driven — tournament results
(decklist appearance/win-rate deltas, new-archetype jumps) become a Riftbound-only
descriptive-then-validated signal layer. Needs a structured results source; explicitly
not applied to Pokémon. Revisit at the 3-month review (`docs/model-gaps.md`).

**Model governance (2026-09-02):** gaps register + accepted limits (strategic buyouts
are unpredictable from price data — accepted) + monthly-evaluate/trigger-refit review
calendar live in `docs/model-gaps.md`. 90-day and 1-year model steps documented there;
30-day market stays the strategic priority. At the next promotion: stamp a model
version into `signal_history` (track-record integrity).

Deferred (unchanged from research §15.7): character priors,
pull-difficulty score adjustments, execution-aware net returns. (Early Value Estimate
graduated to P7.)

## Q. Code-review follow-ups (from the 2026-09-03 refactor program)

Open findings the September review (`docs/codebase-review-2026-09-03.md`) recorded but did
not act on; each needs a product or design decision before code changes.

- **Q1 complete 2026-10-14 — Shared row/chart history snapshots.** Deployed to both
  environments, migration 0021 applied, and every existing eligible series populated
  from stored observations (19,044 staging; 19,085 production). Audits found zero
  version/metric mismatches; live browser checks passed. Build notes and decisions
  moved to `docs/todo-completed.md`. Staging remains cron-less; sales remain paused.
- **Q2 — Collectr `matchCards` feed fallback** sees only the top 50 rows per market and runs
  two catalog queries per call (review §8.5, §8.10). Dev-only path today (production matches
  against D1); tighten or delete once the feed fallback is retired.
- **Q3 — vinext link prefetch console error.** `[vinext] RSC prefetch setup error: d is not
  a function` (vinext 1.0.0-beta.2, `dist/shims/link.js`) fires once per top-bar link on
  `/import` and after scrolling `/sets`, on staging's older build too. Framework-internal; no
  user-visible effect. Re-check on the next vinext release before filing upstream.
- **Q4 — Component-level smoke tests** for the leaderboard view modes (render each with
  fixture rows). The four Playwright journeys cover state, not every view (review §11).
- **Q5 — Feed payload size.** The largest section feeds are 1–2 MB uncompressed; trim fields
  the leaderboard never renders, or page the largest sections through `/api/catalog`. A
  product decision (review §11).
- **Q6 — `/sets` directory latency (measured 2026-09-03).** *Wave 12: fixes (a) and (b) shipped — one round trip; since wave 15 the directory is served from the Worker's colo cache keyed by the publish signature (ISR was removed in wave 13); (c) precompute remains optional.* Time to first byte is 1.8–3.5 s
  on production, versus ~0.45 s for the home page or a static asset and 0.7–1.5 s for a
  one-query API route; staging's older build shows the same, so it predates the refactor.
  The cron was idle during measurement, so it is not ingestion contention. Cause, from
  `db/sets-service.ts` `loadSetsDirectory` and `EXPLAIN` on the local max-profile copy:
  1. **Six sequential D1 round trips** — `publishedIngestion` → singles group-by → sealed
     group-by → the two momentum windows (these two already run in parallel) → releases →
     signals. Each trip from the edge to the ENAM database costs roughly 200–300 ms, so the
     serial chain alone is ~1–1.5 s. All five data queries depend only on the published run
     and could run in one `Promise.all` (or one `db.batch`).
  2. **The two momentum-window queries scan `market_metrics`** (16.5k rows) with two temp
     B-trees each (`SCAN mm` → window `ORDER BY` → `GROUP BY`); the release query scans
     `product_details` (16.9k). Locally all six queries total ~150 ms warm; D1 adds its own
     per-query execution overhead on top of the round trip.
  3. **No caching.** The route is a server component with no `Cache-Control`, so every visit
     recomputes a payload that changes once a day (after the metrics rollup). `worker/index.ts`
     or the route can set `public, s-maxage=…, stale-while-revalidate` the way `app/api/cache.ts`
     tiers do for the API routes.
  Fix order by payoff/risk: (a) parallelize the five reads — behavior-identical, expected
  ~1 s saved; (b) cache the directory HTML at the edge for an hour — payload is daily; (c)
  precompute a `set_directory` table in the metrics rollup so the page is one indexed read.
  Related cost note: D1 reports ~335 M rows read per day (≈ $10/month at list price); the
  rollup and history passes, not this page, are the likely bulk — worth a rows-read audit under §M.
- **Q7 — D1 rows read: 366 M/day (measured 2026-09-03 via `wrangler d1 insights`).** *Wave 12: F1, F2, F4, F5, F6, F7 shipped; F3 deferred (see review §14). Re-measure with `wrangler d1 insights --timePeriod 1d` a day after deploy.* Attribution
  and fixes are in `docs/codebase-review-2026-09-03.md` §14. Headline: 45% is the detail page
  loading the whole game catalog twice per view (`getDetail` → `productRows("single"|"sealed")`,
  ~43k rows each), 40% was the set-detail observation scan that migration 0013 turned into an
  index seek today (2.7 M → 19 k rows per call), 6% is the early-value first-observation scan
  per detail view, 2% the peer-anchor 180-day scan per detail view. Ingestion itself is under 1%.
  Fix order: F1 peers by set instead of whole-game loads (+ per-game in-isolate cache); F2
  early value from a precomputed first-observation column; F3 peer anchors from the daily
  rollup; F4 = Q6; F5 index `catalog_products(ingestion_run_id)` for the readiness count; F6
  one join instead of four correlated subqueries in `/api/signals`; F7 edge cache for detail
  and set pages. Expected: ~366 M → under 30 M rows/day, and reads that scale with the set
  size rather than the catalog size.
  *2026-09-04 re-measure (per-query `rows_read`, review §15): the audit's projection missed the
  early-value sibling-set list (14 k rows on every detail view), the sets directory's true cost
  (~400 k rows per uncached view) and the metrics page (~600 k, never cached), so the post-wave-12
  floor was ~105 M/day, not 30 M; and the tiered history refresh would have added ~180 M/day the
  first night it ran (1.6 M rows per tick to build its target list). Wave 14 removed the
  detail-table and mover history fan-out, memoized the set list, bounded the target read,
  edge-cached `/metrics`, and fixed R2; the estimate was ~65 M/day at that traffic; Q9 carries the measured figures
  since (66 M on a clean day, 273 M on the 2026-09-09 crawler day). Remaining levers are Q8.*
- **Q8 — precompute the daily aggregates the whole-catalog pages recompute per view (from review
  §15).** The sets directory (six group-bys and two window queries, ~400 k rows), set EV (49 k,
  read by set detail, `/api/set-ev`, and metrics), and the metrics payload (~600 k) all derive from
  the day's rows and change only when a run publishes. Computing them in the metrics rollup into a
  small table (or KV) turns each view into a few hundred rows and stops depending on the colo
  cache hit rate; the set-detail observation aggregation (Ps × days, growing ~365 rows per member
  per year) belongs in the same rollup as a per-set daily index. Order: set EV → directory →
  set index → metrics payload.

**Q9. Peer anchor is now the largest read (2026-09-05 insights, first clean day after wave
14: 66.0 M rows/day, from 337 M).** `db/peer-anchors.ts` — the detail page's 180-day cohort
average — read 40.1 M rows in 24 h (61% of all reads): 13.9 k rows per call averaged over
~2,900 detail views, far above the 3.7 k the review measured on one cohort, because large
cohorts (promo sets, hundreds of cards × 180 days) dominate. Every card of one set+rarity
shares a cohort, so a per-isolate memo keyed by (game, set, rarity) with a ten-minute TTL
(the early-value set-list pattern) removes most repeats from crawlers walking a set; the
durable fix is a per-cohort daily average table written by the rollup (Q8). *Memo implemented
2026-09-09 (`readPeerAnchor` keeps each cohort summary per isolate for ten minutes; failed reads
are not kept) after the query reached 142 M rows a day on 16 k detail views.* Remaining lines
that day: whole-game isolate loads 6.1 M (278 cold isolates), `/api/signals` 2.9 M, set EV
2.3 M; 6.9 M were the operator's own R3 verification queries (full observation scans) and
will not recur.

## S. Crawler and bot traffic (Cloudflare analytics, 2026-09-04)

- **S1 — most visits are automated.** Analytics showed ~3.8 requests and ~30 KB per visit against
  ~34 per visit in the prior period, 4xx errors up 907%, 2% unencrypted requests, and datacenter
  geographies (Russia, China, Finland, Netherlands, France, Germany). *Shipped 2026-09-04 (wave 15):
  the page edge cache is keyed by the publish signature and held 36 h; `public/robots.txt`
  disallows `/api/`, `/data/`, `/_vinext/`, `/__ops/` with a crawl delay; `/sitemap.xml` lists the
  core pages and every set page.* Operator steps still open, in order: read Security → Bots for the
  verified/unverified split; enable Bot Fight Mode and Block AI bots (and AI Labyrinth); WAF rule
  challenging non-verified datacenter-ASN traffic on `/cards/*`, `/sealed/*`, `/sets/*`; a WAF rule
  blocking `/api/*` and `/data/*` requests without `Sec-Fetch-Site: same-origin` (verified bots
  excepted); one rate limit on the detail paths (~30/min per IP); Turnstile on the Collectr import;
  re-read the D1 24 h counter and the Bots panel a day later.
- **S2 — managed challenge observed live (2026-09-09 ~23:40Z).** Between the 23:09Z status
  check (curl 200) and the Q9 deploy verification, `rawsignal.cards` began answering
  `Cf-Mitigated: challenge` (403 "Just a moment…") to non-browser clients: plain curl, a
  spoofed Googlebot user agent from a residential IP, and `/api/signals` were all challenged;
  a browser user agent, the in-app browser, and `/sitemap.xml` got 200; workers.dev staging is
  untouched. Consequences and checks: (1) every external API consumer — including any future
  public signals endpoint (§O plan) — is challenged unless a WAF exception covers `/api/*` for
  the intended clients; (2) confirm Security → Bots shows verified bots (Googlebot, Bingbot)
  allowed through, since Cloudflare verifies them by IP, not user agent — the spoofed test from
  here proves nothing about the real crawlers; (3) production checks from tooling must send a
  browser user agent. Measure the effect together with Q9: on 2026-09-09 the day read 273 M rows
  on ~16 k detail views (peer anchor 142 M); re-read `wrangler d1 info` and the top insights
  after 2026-09-10 23:00Z to split the drop between the challenge (fewer views) and the memo
  (fewer rows per view).

## R. Production ingestion (R1–R3 shipped — see the completed doc; R4 fix 3, R5, R6 activation, and R7 open)

**R6. Detail sales-window summaries (implementation 2026-10-09; paused).**
When enabled, 7D/30D/prior-30D TCGplayer units and period comparison use the detail
history response. Independent sales timestamps in the parked sales-table SQL
prevent price updates from presenting stale sales as fresh; the dormant UI would mark
legacy totals as having unknown freshness.
The new feature is switched off in `core/domain/sales-summary.ts`: no new UI,
summary database reads/writes, or additional API request. The sales SQL is parked at
`docs/paused-migrations/sales_summaries.sql`, not in the active migration chain.
Existing price history, its sales fields, and signal liquidity remain unchanged. See
`docs/sales-volume-2026-10.md`. Deploy/migration remain unrequested. Separately resolve the
history-access failure found in the September 28 audit before promising current volume;
daily-bar granularity and Full-view volume remain deferred.

Pause boundary (2026-10-09): the detail page omits `sales=1` from its existing
`/api/history` request and does not render the new 7D/30D/prior-period tiles; the
history route skips the summary lookup even if a client supplies `sales=1`; history
ingestion skips the `sales_summaries` upsert and the client skips its summary calculation.
This adds **zero** summary-table reads/writes and **zero** extra upstream calls while
paused. The ordinary price-history request and older sales-derived signal fields still
run. Before activation: restore authorized detailed-history access, verify source
freshness and representative card/sealed buckets, assign the parked SQL a new migration
number and apply it only with a
user-authorized deployment, turn the switch on, and re-run the complete gate.

**R7. Daily sales and cross-market supply on card/sealed detail pages (research
2026-10-09; open).** Use the source and cost boundaries in
`docs/sales-volume-2026-10.md` §Daily sales and marketplace supply research.

Reconfirmed after the 2026-10-14 snapshot deployment: production's
`history-daily:2026-10-13` fails `History quarter unavailable` at its upstream fetch.
This predates the snapshot change and remains unresolved. The deployed, populated
price snapshots and daily TCGCSV updates do not require that endpoint; they cannot
provide fresh completed-sale counts. Sales activation remains paused.

- [ ] Restore and verify authorized TCGplayer detailed-history access; confirm source
  bucket dates and freshness on representative Pokémon/Riftbound singles and sealed
  products. Until then, keep existing sales figures stale/unknown and do not derive
  sales from TCGCSV price updates.
- [ ] Present TCGplayer completed-sale volume at its actual three-day resolution,
  with printing/condition and source date. Seek a licensed daily-granularity feed
  before adding exact daily bars; label any three-day average as an average.
- [ ] Add clearly scoped eBay active-listing supply from the existing six-hour
  Browse snapshot: raw query-result estimate versus reviewed/accepted matched
  sample, with fetch time. Never label the broad `total` or the sample count as
  exact matching copies available across the marketplace.
- [ ] Evaluate eBay remaining-copy quantity only if an item-detail-call budget and
  completeness study support it. Keep listing and unit counts separate, and check
  product/printing/language/condition matching before aggregation.
- [ ] Find authorized marketplace-wide TCGplayer inventory and eBay completed-sale
  sources; document licensing, coverage, freshness, API cost, and the exact unit
  definition before showing those unavailable measures. Seller-only TCGplayer
  inventory endpoints are not marketplace totals. No sell-through or days-of-supply
  calculation until sales and supply are comparable in scope and time.

**R4. Overlapping guard-cron ticks halve the live walk, then the minimum-records guard
resets it (found 2026-09-05 03:50Z).** The `live-daily:2026-09-04` run took 7.2 h
(20:07→03:19Z) against 4.4 h the day before, wrote
9,123 records with 9,591 duplicate decisions (1,320 the day before), and stamped rows at a
flat 2,400/h — 40 a minute against an 80-record tick every minute. No minute wrote more than
80 observations, so ticks are not writing concurrently; the pattern fits a trailing tick that
starts while the previous one is still mid-slice, reads the same cursor, finds every record
already stamped (all duplicates, no writes), and checkpoints the same cursor — one wasted
minute in two. Ticks are ~12 D1 ops per record × 80 records, i.e. right at the 60 s cron
period, so any D1 latency increase tips them over. Second-order effect, observed 03:54Z: each
tick checkpoints `recordsWritten` from the stats it read at start plus its own writes, so the
trailing tick's checkpoint clobbers the leader's count; by the end of the pass the stat read
9,123 while 18,284 rows carried the run id, the `minimumRecords` (10,000) guard judged the
day truncated and reset the cursor to 0:0, and the re-walk (cursor 1:133 at 03:54Z) finds
every row stamped, so it will write nothing, fail the guard again, and loop until the run id
changes with the next publish — the 2026-09-04 publish never lands, and the rollup and
history for it never run. Fixes, in order: (1) a tick lease in `refresh_state`
(`key='cron-lease'`, `lease_until`) claimed with one conditional UPDATE at tick start and
released at the end — a tick that cannot claim it exits idle; (2) the guard counts stamped rows
in D1 (`count(*) where ingestion_run_id=?`) instead of the racy stat, and a reset re-walk that
finds rows already stamped counts them as written; (3) halve the live slice to 40 records so a
tick finishes well inside its minute (the chain has hours of headroom).
*Fixes 1 and 2 shipped 2026-09-05 (`d7de3b9`, production `ea6fdbaf`): `db/tick-lease.ts` claims a 170 s
lease in `refresh_state` (`cron-lease`) with one conditional upsert and the tick exits idle
when it cannot; the live walk's truncation guard and its published count use the rows the
database holds for the run, so a reset re-walk publishes. The stuck 2026-09-04 re-walk completed under the new
guard and published at 07:48Z on 2026-09-05; the chain has run daily since. Fix (3), the
40-record live slice, is not implemented (`LIVE_BATCH_SIZE` stays 80) — open, low priority
while ticks finish inside the lease.*

**R5. Observations dated by wall clock, not by the run.** `observed_date` is the tick's UTC
date, so a live walk that straddles midnight splits one TCGCSV publish across two dates
(2026-09-04: 8,742 observations dated the 4th, ~9.5 k dated the 5th; the 3rd's run put 1,607
onto the 4th). The set index and metrics treat each date as a day of coverage, so straddled
days undercount members and can fall under the 60% coverage floor. Fix: date observations
and `as_of_date` by the run's source date (`sourceUpdatedAt`), one date per publish; decide
how to treat the existing split days (leave, or re-date the post-midnight rows of a run).
