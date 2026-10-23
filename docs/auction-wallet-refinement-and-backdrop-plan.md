# Auction lobby refinement and Backdrop Loop Track follow-up

**Follow-up shipped to staging:** smaller wallet/statistics tiles use site-native
plain surfaces, with green/red financial results. The existing green Wallet and
blue Your Next Collection parent backgrounds are retained by explicit request.
Stable artwork assignments and Daily Challenge placement are deployed; see
[the follow-up record](auction-backdrop-stable-slots.md). The verification/release
sections below describe the preceding release, not the latest follow-up.

## Shipped UI intent

The **Auction Wallet Summary** keeps the same cash-first hierarchy and accounting,
but removes duplicate navigation, a standalone Refresh Market control and repeated
explanations. Existing Auction Hub links own navigation. Reset Cash & Inventory is
a red destructive control, with the existing confirmation unchanged. Guide uses
the same inactive/active button backgrounds as the other Hub items.

Rename Virtual Net Worth to **Total Net Worth**, Protected Showcase to **Showcase
Value**. Inventory/showcase amounts read as `$71.81 – 76 Cards`, wrapping only where
necessary. Remove the spendability tagline, sum description, separate card-count
footers and the after-fee/protection paragraph. One **Wallet valuation** tooltip
consolidates fee/protection/total definitions and gross market values. Missing
prices remain N/A with a compact known-subtotal line, not a false zero. Loading
and resolved rows share reserved geometry; cash still does not wait for artwork.

No auction rules, balances, fees, catalogs, saves or privacy choices change.

## Removing Refresh Market

On the deployed compact-catalog staging path, `useAuctionCatalog` checks the manifest
on mount and when the tab returns to visibility (except while a dialog is open).
`useAuctionEntry` force-checks before creating a new auction draft. Existing drafts
retain their frozen contents/prices. Inventory sale confirmation checks latest
prices and requires confirmation again if the quote changes. `AuctionMarketStatus`
retains Retry Catalog / Retry Price Check for failures; last valid prices remain
available under the existing policy. No polling or new refresh mechanism is added.

The legacy feed path checks on mount through its five-minute document cache; it
does not gain an entry-time version check in this UI change. Compact delivery is
already enabled on staging and is preserved. This is not a claim of live resale
quotes, nor an authorization to enable compact delivery in production.

The cache browser fixture now invokes refresh through an explicit test-only
control, not a production wallet button. Its reuse/failure/frozen-lot and changed
sale quote reconfirmation assertions are retained.

## Backdrop Loop Track: findings, not a completed fix

Read-only staging observation used an isolated guest browser for 75 seconds,
crossing the normal 70-second animation boundary. Every sample retained the same
background root, image nodes and animation objects; animation current time advanced
past 70 seconds. All 54 image elements decoded by the first 15-second sample.
Resource-entry count remained 86 through the remaining samples, with no later
source mutations after initial warm-up. No page error occurred. This did **not**
reproduce a document reload or recurring image-source reload at the CSS seam. It
does not establish smooth GPU frame pacing or reproduce the user's signed-in session.

Local image-error injection then changed **54 of 54 source slots**. The cause is
visible in `AuctionBackdrop`: `available = art.filter(!broken)` compacts the shared
candidate list, and every slot indexes into that shortened list. Removing an early
candidate shifts otherwise healthy cards across all lanes, causing fade/decode
work and potentially more image requests. Stable React element keys preserve DOM
nodes, but do not preserve their assigned image sources. Thumbnail-to-original
fallback is also stored separately by each clone. This is a concrete broad-refresh
mechanism, not proof that every reported periodic stutter has this cause.

Other risks to measure:

- Resize changes slot count and loop width at the current animation phase.
- Profile overrides replace the catalog; effect cleanup can temporarily restore
  defaults. Account loading/error legitimately removes the background, then a
  later mount selects a new visit seed.
- Large transformed layers, rotated images, mask and opacity can cause compositing
  stutter despite correct seamless geometry, without an HTTP request or remount.

### Recommended implementation order — plan only

1. **Stable Artwork Slots:** assign each logical slot a persistent image identity.
   Replace only slots using a rejected source; never compact the entire assignment
   pool. Share source/fallback/ready state between that slot's repeated twins.
2. **Decode-before-swap:** retain a healthy current image while a replacement loads;
   publish the decoded replacement to both twins together. Initial empty slots can
   remain invisible. Bound replacements/concurrency and retain the 18-artwork budget.
   Never block foreground balances, catalog metadata or controls.
3. **Phase-safe updates:** preserve lane phase when resizing/adding coverage and
   avoid transient default catalogs during a profile override handoff. Randomize
   on a deliberate new visit, not on incidental price/render state. Preserve owner
   isolation and intentionally clearing revoked/private profile backgrounds.
4. **Long-loop acceptance:** test several full forward/reverse cycles, failed and
   delayed thumbnails/originals, tab visibility, resize, profile navigation and
   catalog changes. Assert healthy slot sources remain unchanged, twins agree,
   network work stays bounded and animation time does not restart unexpectedly.
5. **Compositor follow-up if needed:** capture frame/paint traces on the affected
   browser. Try fewer rasterized layers or smaller decorative textures before
   considering a canvas renderer. Canvas can reduce DOM layers but adds image
   lifecycle, rendering and reduced-motion complexity; a general rewrite is not
   the first step. Existing physical Safari testing remains separately deferred.

Evidence is ignored under `outputs/backdrop-refresh-probe.json` and its `.log`.
The fault injection affected only the isolated test browser; no account/auction
writes or server changes. Backdrop behavior is intentionally not modified in this
release: the user requested assessment and solutions, not an unmeasured rewrite.

## Calmer color scheme suggestions — not applied

1. **Graphite + Signal Blue (recommended):** neutral graphite/slate panel fills,
   one muted blue treatment for section borders and primary actions, mostly white/
   theme text values. Keep red/green for actual P/L and red for destructive actions;
   remove category-colored full metric backgrounds. Best match for the market site.
2. **Midnight + Teal:** neutral dark-blue/slate fills with a restrained teal accent
   for interactive emphasis, normal neutral statistics, semantic P/L only. Softer
   and cohesive, but teal must not be confused with positive financial movement.
3. **Graphite + Brass:** neutral panels with muted gold/brass emphasis on paid entry
   and selected headings, standard blue interaction/focus and semantic P/L. More
   premium auction character; use gold sparingly so it does not imply guaranteed
   value or compete with rarity colors.

All choices need light-mode token counterparts, readable text, flat hover/focus
feedback and a before/after review. Current tints stay unchanged until a direction
is selected. This request changes layout/copy/buttons, not the full-page palette.

## Local verification

The final complete `npm run check` passed: build, 675 unit passes (one existing
skip), lint/type check and all 165 Chromium journeys. The 21 pre-existing complexity
warnings remain; none was added. Focused checks retained sale reconfirmation,
frozen-auction, protected/unpriced inventory, destructive reset confirmation and
same-document Hub navigation assertions. A focused mobile test caught a 24.75px
control shift when Loading changed to a shorter price; reserving the two-line
value/count space fixed it without loosening the less-than-one-pixel assertion.
The follow-up six-case loading/wallet suite passed. Desktop/phone, both themes,
320px and large-font screenshots were reviewed. Evidence remains ignored under
`outputs/wallet-compact-release-check.log`, `outputs/wallet-compact-focused.log`,
`outputs/wallet-compact-layout-retry.log` and `test-results/`.

## Staging release and live verification

Application `ef48bd2` pushed to `codex/accounts-and-collections` and deployed to
staging `ec0eff58`. Identity/save bindings, account flags, secrets and limiter
namespaces were preserved. Staging still has no cron; production is unchanged.
No migration, catalog ingestion or account writes.

Live isolated-guest checks with local-only test holdings passed exact existing
valuation totals, compact labels/counts, one tooltip, red reset border, no wallet
navigation/refresh controls, and matching inactive Guide/Inventory backgrounds.
All four desktop/phone dark/light large-text views had no overflow. The first live
style comparison sampled a mobile theme transition mid-animation; comparing both
controls in one frame after the existing transition completed passed. This needed
only a verification-script timing correction, not another application change.
Hub Inventory/My Showcase navigation retained the document with zero additional
catalog reads. No page errors or non-GET API attempts occurred.

The nine-surface market/auction smoke also passed desktop/phone and both themes:
all HTTP 200, no overflow/page errors/writes. Background/document retention and
zero catalog reads passed Hub navigation. The compact snapshot remains unchanged
at 1,583 printings, 128 with unavailable prices. Evidence is ignored under
`outputs/wallet-compact-staging-verification.json`,
`outputs/wallet-compact-staging-initial-theme-transition.json`,
`outputs/wallet-compact-live-smoke.log`,
`outputs/loading-followup-live-wallet-compact.json` and private
`outputs/wallet-compact-staging-release-*` setting/version records.

Backdrop behavior and the broad lobby palette are **not changed** in this release;
the findings/recommended next implementation and palette choices above remain plans.
