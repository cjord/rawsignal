# Pokémon Auction House — staged implementation

Work resumed November 19, 2026. The user authorized sequential implementation,
GitHub pushes and staging deployments after each validated stage. Production is
outside this release. Existing TODO edits, article drafts and the unrelated image
remain excluded. Continue on `codex/pokemon-games`; remote main was inspected
before new changes and remains the integrated article baseline.

## Stage 1: rules and storage boundary

Pokémon now uses the shared lot generator and round engine through explicit
market rules. Exact source rarity, name, printing, price and selected era/set
remain attached to every card. Eight internal effect cohorts let the existing
investigation/valuation machinery operate without inventing Pokémon signatures
or merging printings. Display labels must use the actual Pokémon terminology.
Generation weights are game composition, not real pack pull rates. Available
cohorts are renormalized within the chosen pool; no unselected sets are added.

Pokémon's account document uses the already reserved
`raw-signal-pokemon-auction-v1` key. Both parsers reject the other market, invalid
rules versions and cards outside a frozen selection. Existing Riftbound saves
retain their unmarked v1 format. Pokémon preparation stores at most 600 exact
candidate cards instead of the complete multi-megabyte catalog. Cancellation
must retain those candidates, seed, opponents and scope. Pokémon common stock
uses a four-card playset policy subject to the collection theme's lower cap;
larger duplicate piles become progressively less likely.

Focused checks cover deterministic lots and tier bounds, missing prices/language
exclusion, exact printing preservation, scope and cross-market corruption,
account size, settlement and investigations/public reveals. The first full gate
found an unused import in an ignored operational helper left from the previous
bulk admission; that helper was corrected without changing application behavior.

This stage intentionally does not expose an unfinished auction entry route.
The playable surface, mapped investigation descriptions, rival presentation,
inventory/showcase and scope setup follow in stage 2. Daily runs and community
projections follow only after the normal economy is verified. Never expose
Riftbound public profile settings as Pokémon visibility controls.

## Remaining release gates

Stage 1 source validation passed: `npm run check`, 739 unit passes / one existing
skip, build, lint with no new warnings, typecheck and all 198 Chromium checks
(10.6 minutes for the browser suite, no retries). An initial restricted browser
server could not connect to its local runtime; rerunning with local-server access
resolved that environment failure without changing application assertions.

1. Complete full source gate, commit/push and stage stage 1; verify live catalog,
   original settings/bindings, daily archive hashes and account-save aggregates.
2. Build/playtest the normal Pokémon auction UI using shared components and
   selected catalog pools. Measure free/paid outcomes by representative era/set.
   Validate cancellation/reload, late timers, broken artwork and missing prices.
3. Add immutable shared daily auction manifests in the existing market-aware
   archive, independent attempts and atomic one-time Pokémon rewards. No replay
   of legacy Riftbound daily state or links.
4. Add separate public visibility/projections, moderation and community routes.
   An additive database change needs a concrete reviewed migration and backup
   approval before remote application. Keep private inventories/wallets out of
   public responses, and preserve account export/deletion behavior.

Every public batch must pass `npm run check`, be committed and pushed before
deployment, preserve the enabled staging bulk reader with its producer off, and
keep staging cronless. Frozen daily snapshots must not be rewritten for a release.

## Era-house decision during implementation

The initial 1,200-run historical-snapshot simulation found radically different
values across eras. For example, unrestricted WotC lots had median values around
$5,331 free / $19,812 paid, versus $84 / $483 in Sword & Shield. These are game
simulation outputs against the admitted November 8 snapshot, not current market
forecasts. The simulated human passed; this is not live-player behavior.

After reviewing this finding, the user chose:

- Modern: Sword & Shield, Scarlet & Violet and Mega onward.
- Legacy: Black & White through Sun & Moon.
- Vintage: WotC, EX and DP–HGSS.
- A separate $200 Vintage house, with smaller, mostly everyday collections and
  occasional chase cards; unlock it after $10,000 Pokémon net worth is earned.

Use Cinnabar Auction House for the Vintage presentation. Interpret "unlock after"
as a permanent earned milestone based on known after-fee Pokémon net worth,
including protected showcase cards. Unpriced holdings do not count as zero-valued
cards; a known subtotal may establish that the threshold has already been met.
Entry still requires $200 cash. The ordinary five-auction daily challenge remains
three free/two $50 entries; it does not silently introduce the gated vintage tier.

## Stage 1 staging acceptance

Source `c6529f2` was committed/pushed and deployed as `341585ed`. Live game catalog
checks passed. Original settings/bindings, zero schedules, exact existing daily
archives, account-document aggregates and the production deployment were
unchanged. No ingestion or migration was run. The previously local bulk-admission
report was included in the authorized branch push.

## Stage 2: playable auctions and portfolio tools

The Pokémon layout supplies a small game context to the existing auction shell.
The shared `AuctionHouseSession` takes one save owner, avoiding duplicate save
hooks or competing timers during pool setup. Thin routes reuse Inventory,
Showcase and Profile Studio; Pokémon appearance uses its own account document.
Frozen showcases use market-pinned v2 links while legacy Riftbound v1 links retain
their old decoding/path. Public Pokémon account visibility stays disabled until
its separate projection/moderation storage is ready; it never reads or writes the
Riftbound visibility endpoint as a substitute.

Setup fetches lightweight metadata, then the chosen scope. Round play adds no
catalog reads. Standalone portfolio pages use the shared cached full Pokémon
catalog so cards from earlier scopes can be repriced; missing printings remain
unavailable. A fresh entry freezes the actual checked catalog version and saves
the last selection. Cancellation retains the prepared seed, lot/prices, rivals
and scope. A pool change explicitly abandons a pending entry before selecting
another, without charging a fee.

Modern/Legacy entries remain 25–90 free or 50–130 paid cards. Cinnabar draws
25–55 Vintage cards with a lower premium mix, charges $200 only after preparation
and requires the permanent $10,000 after-fee net-worth milestone. The unlock uses
the same all-owned quote/fee rounding as the Wallet, counts showcase holdings,
accepts a known subtotal as a lower bound, and survives a normal cash reset.
Inventory extra-copy sales retain four cards in Pokémon and three in Riftbound.

Twelve new original 192 px WebP collector portraits map presentation names to the
existing canonical strategy identifiers. No strategy uses a display name to
choose behavior. Player identity art stays shared. The guide explains rules,
houses, collection themes, actual investigation cohorts, rivals and base draw
weights; those weights are explicitly not real pack odds or final realized
probabilities. Cross-era/unknown promo groups are excluded from era auctions until
their era membership can be established; Showdown's broader options are unchanged.

### Balance evidence

The maintained read-only command is
`node scripts/games/pokemon-auction-balance.mjs <cards.json> <report.json> [runs]`.
It accepts an exported card array or the ignored canonical source audit. This
release used November 8 source prices, 200 seeded auctions per entry/category
(1,000 total), a passing simulated human and no artwork probes. These are not
live-user outcomes, current November 19 price forecasts or confidence intervals.

| Category / entry | Median lot | Median NPC opening | Median winning bid / gross value | Round-1 NPC buyout | NPC winner loss after fees |
|---|---:|---:|---:|---:|---:|
| Modern free | $176.37 | $55.26 | 64.8% | 13% | 16% |
| Modern paid | $753.92 | $270.01 | 50.9% | 3% | 6% |
| Legacy free | $641.73 | $215.46 | 65.9% | 5% | 8.5% |
| Legacy paid | $2,938.27 | $1,122.26 | 54.3% | 4% | 6.5% |
| Vintage / Cinnabar | $3,388.22 | $1,484.83 | 75.2% | 14% | 18% |

No lot-generation failures occurred. Scope prices legitimately vary; a fixed $300
opening floor across all eras would misprice many pools. Pokémon-only catalog
speculation was modestly increased for Modern/Legacy (paid opening median rose
from $213.31 to $270.01 in this sample). Vintage uses a smaller speculation weight
because its disclosed evidence already produced firmer bids. All schedules fade
by round. Riftbound coefficients and automatic-private-sample policy are unchanged.
NPCs still use only public reveals, their chosen investigations, catalog priors
and previous completed bids. Winning-bid ratios omit entry/investigation expenses;
the winner-loss column measures NPC modeled resale loss after the selling fee.

The initial unrestricted WotC-only comparison and current WotC/EX/DP–HGSS vintage
sample have different pools, so their median difference is not a controlled A/B
percentage improvement. Single-set pools and real human pressure merit ongoing
calibration, especially inexpensive pools where $50 can be a meaningful fraction
of value. No profit guarantee or hidden minimum collection value is imposed.

### Artwork provenance

The built-in generator produced one 4 × 3 sheet of distinct original adult
collector/trainer portraits, in a consistent semi-realistic style with navy
backgrounds and blue rim light. The sheet was inspected and sliced/resized to
`public/images/games/pokemon-rival-*-v1.webp` using the existing image tooling.
No separately billed API fallback or new dependency was used. The genuine card
back reference credited in the November 9 artwork report was optimized as
`public/images/games/pokemon-card-back-v1.webp`. Decorative background cards are
a separate 45-card selection from the admitted catalog, never the hidden lot.

Portrait prompt specification: one exact 4-column/3-row equal-cell sheet, original
shop owner, premium collector, route explorer, researcher, chase hunter, bargain
scout, league fan, archivist, deck builder, inspector, tournament veteran and
wealthy trophy collector; diverse adult faces, contemporary outfits, matching
head/shoulder framing, no text, no logos, no existing Pokémon characters or
creatures. Generated originals and the full prompt remain ignored locally.

### Focused acceptance

Nine Pokémon domain checks and five focused Chromium journeys passed before the
full gate. They exercise exact pricing/printing, source/category isolation,
bounded/cancelled preparations, persisted settlement, gated vintage entry and
one-time fees, protected showcases, keyboard transfers, market-pinned frozen
sharing, legacy link rejection and guide terminology. Screenshots cover setup at
desktop/mobile widths in both themes and mobile-light play under reduced motion.
This is automated Chromium evidence, not physical Safari acceptance. The full
gate also caught a missing explicit `.ts` suffix in the Node-reachable artwork
preparation import; that path was corrected and the preparation suite passed.

Stage 2 full gate passed: production build, 742 unit passes / one existing skip,
lint (no new warnings), typecheck and all 203 Chromium checks without retries.
The browser suite took 19.5 minutes on this run; that wall time is not a controlled
page-load comparison. Live staging acceptance follows the committed release.

Stage 2 was committed as `407716e`, pushed to `codex/pokemon-games` and deployed
to staging as `f7a7fdbb`. A live isolated guest auction used real published prices
and artwork through all four rounds and settled successfully. It made two
catalog requests, zero legacy feed requests and no between-round price requests;
no browser errors were observed. Desktop-dark bidding and mobile-light settlement
were inspected. Production, existing daily archives, account-document aggregates,
bindings and the zero-cron staging policy were unchanged.

## Stage 3 — Pokémon daily auctions and frozen result sharing

The daily snapshot uses Modern, Modern, Legacy, Modern, Legacy pools in that
order, with three free Pewter entries followed by two $50 Celadon entries.
Cinnabar/Vintage is excluded, so the daily challenge never depends on an account's
normal-wallet unlock. The existing five-auction engine supplies the independent
$2,500 bankroll, 10% automatic selling fee, expiry/failure rules and one-time 25%
positive-profit reward. Normal inventory, showcase and statistics remain separate.

A version-2 Pokémon manifest freezes the exact lots, source/category identities,
priors and rival roster. The existing shared-manifest table stores one immutable
row per market/challenge/date; no new migration is needed. Concurrent first
visitors reuse initialization. Artwork failures replace stock within each draft's
era scope; transient failures or a midnight crossing do not publish a new row.
Historical reads never recreate a missing date or reprice an existing archive.

The daily screen downloads its frozen lineup when Start is selected, without a
full practice-catalog download. Decorative artwork is independent of the hidden
lots. Pokémon result links pin the market and catalog identity; Riftbound v1 links
retain their existing contract. Result-card inspection uses frozen art and prices,
including bulk cards that deliberately have no public market-detail route.
Sharing remains explicitly self-reported and does not store a new public profile.

Domain coverage exercises deterministic scopes, concurrent archive initialization,
artwork replacement, midnight/failure paths, account-save validation, all five
settlements, automatic sales, exact fee/reward reconstruction, repeated completion,
wrong-market rejection and normal-progress preservation. Browser coverage checks
reload/resume, no catalog requests, frozen result inspection, market/version
rejection, discoverability and desktop/mobile dark/light layouts. Release and live
acceptance evidence follows the release gate. The complete stage-3 gate passed:
production build, 747 unit passes / one existing skip, lint with no new warnings,
typecheck and all 206 Chromium checks without retries (17.8 minutes for the browser
suite). Existing local market-detail fixture warnings about an older metrics
column also appear in the stage-2 baseline; they are not new game failures or a
claim that the local database has been refreshed.

### Live artwork correction

The first stage-3 deployment (`697fcc97`, source `0c40b7b`) preserved protected
data but failed live daily initialization with a retryable 503; no attempt or
daily archive was consumed. Real bulk stock includes broken CDN artwork (one
403 in a 12-image sample). Regenerating whole large lots repeatedly introduces
new unchecked images and can exhaust the first-use check budget.

The correction selects at most 200 seeded candidates per category, checks those
400 candidates once, and builds all five collections from the healthy result.
The shared manifest pins that verified pool. Missing category stock fails closed;
it never broadens into Vintage or substitutes guessed prices. Historical archives
remain immutable. Safe server diagnostics record only initialization phase and
error type. Riftbound's original artwork preparation is retained unchanged.
A 1,600-card regression fixture with 10% broken images must publish a valid lineup
with exactly 400 checks and no repeated candidate requests.

The correction passed the complete release gate: 748 unit passes / one existing
skip, build, lint with no new warnings, typecheck and all 206 Chromium checks
without retries (17.0-minute browser run). Live verification follows its staging
deployment; the earlier 503 is not recorded as a completed daily acceptance.

The correction (`efed85f`) was pushed and deployed to staging as `d86304a2`.
Live isolated guest acceptance completed all five auctions with real prices,
real artwork and natural NPC bids, using accelerated timers. Reload/resume and
the frozen shared-results page passed; no browser errors or practice-catalog
downloads occurred. Initial lineup preparation took 8.386 seconds in this one
run, not a controlled performance benchmark. Existing snapshots are read without
rechecking artwork. Desktop-dark bidding and mobile-light results were inspected.

Post-live fingerprints verified exactly one expected new Pokémon auction archive
for November 19. Every older daily archive, market publication/count, account-save
aggregate, existing binding, production deployment and staging's zero schedules
remained unchanged. No account was signed in or modified by live acceptance.

## Stage 4 — independent community presentation and recovery

The shared directory, profile, visibility and moderation implementations now take
an explicit game boundary. Riftbound retains its routes, IDs, unmarked response
format and save projection. Pokémon adds its own paths, response market marker,
market-pinned cursors, account visibility choices and score projection. Public
showcases rank by gross current showcase value; leaderboards rank by normal-game
net auction profit. Daily results are excluded. Both remain browser-reported and
unverified. Nothing opts an account into public viewing automatically.

New Pokémon public values resolve canonical exact printings from the published
market catalog plus admitted game-only stock. Bulk requires the same completed
run and stock-completeness marker. Missing or wrong-printing prices stay null,
and incomplete showcase valuations sort last. Only selected showcase/decorative
cards and allowed statistics are returned—never wallet, inventory, email or the
underlying private document. Public identity deletion hides orphaned mirrors.

Visibility forms reset across owner/game changes. Visibility writes in both games
must name the account that reviewed the form. Older open Riftbound tabs must
refresh before saving visibility. An account switch during a
cloud-save flush therefore cannot publish choices to the new signed-in account.
Admin moderation selects a game, retains fresh-session/origin/rate/revision checks,
and commits its action and market-specific audit target atomically. Exports add
separate Pokémon visibility when enabled; account deletion cascades both new
tables. Existing frozen snapshot links remain independent and cannot be revoked.

An adjacent recovery correction restores a saved active Pokémon auction directly
from its frozen lot, scope and category. Catalog requests cannot block a return
to bidding or relabel Cinnabar as Celadon. Ownership/account checks still apply;
this is catalog-failure recovery, not permission to bypass authentication while
offline. Fresh pools and inventory sales retain their price-check boundaries.
Daily and frozen-market notices reuse the established bottom snapshot component
instead of inserting raw source timestamps above the arena.

The entry briefing and active header identify the actual Modern/Legacy/Vintage
category, so daily players can see the same era information that informs rivals'
estimates. Mobile shared-results tables use a named keyboard-focusable scroll
region; focused browser coverage verifies Arrow Right reaches off-screen columns.
Its localized accessibility-lint exception follows the existing bid-history and
article-table pattern. The first stage-4 gate caught that missing annotation;
the control's semantics were retained and exercised rather than removed.

### Additive staging migration and activation boundary

`0032_pokemon_auction_community.sql` creates two initially empty Pokémon-only
profile/moderation tables, indexes and three save-projection triggers limited to
the Pokémon account key. It neither rebuilds nor imports existing profiles.
Local migration tests prove separate projections, resets and deletion cascades.

`POKEMON_AUCTION_COMMUNITY_ENABLED` defaults off and cannot be inherited from a
build. Preparation requires staging, accounts, auditing, moderation, community
and the admitted catalog reader. Release order: full gate and source push;
deploy with the flag absent; approved private full staging backup; apply and
inspect the additive migration; then activate the flag on the same validated
source and check live public/guest boundaries. Production and identity bindings
are outside this operation. No cron or ingestion producer is enabled.

Rollback first disables the flag or restores the previous Worker while retaining
new tables and any chosen visibility data. Restoring a full database backup is a
separate recovery decision because it could overwrite newer account progress;
it must not happen automatically. Remote backup, migration and activation remain
pending until their concrete approval and verification are recorded.

### Stage 4 validation

The complete release gate passed: production build, 755 unit passes / one
existing skip, typecheck, lint with no new warnings (21 existing warnings), and
all 212 Chromium checks without retries (18.9 minutes). Coverage includes separate
Pokémon visibility, exact-printing bulk prices, account-switch write denial,
market-pinned pagination, moderation rollback, exports/deletion, and Modern and
Vintage frozen-auction recovery during catalog failure. Desktop-dark and
mobile-light community layouts were inspected. Thirteen unrelated user files
remain byte-for-byte unchanged and are excluded from the release.

Existing local detail-database schema/fallback and marketplace-link hydration
warnings remain visible in the full browser log, as in the preceding release;
they are not newly introduced Pokémon failures. These automated browser checks
are not physical-device recovery testing or a controlled speed benchmark.
