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
