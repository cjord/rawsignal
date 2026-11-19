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
