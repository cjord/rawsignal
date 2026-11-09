# Pokémon game covers and bulk admission controls

November 9, 2026. Follow-up to the [daily release and games review](pokemon-games-review-2026-11-09.md).
This batch prepares real bulk admission before Pokémon auction implementation;
it does not release an auction engine, run remote ingestion or change production.

## Selected artwork

The user selected the left-hand blue Option A for both covers and requested an
environment behind the cards. The final composition retains the genuine English
card-back reference and adds a generated blue-lit hobby-shop display room, felt
table, cabinets and ceiling lights. No replacement card logos were generated.
The auction cover keeps Option A's three-card fan and gavel.

- `public/images/games/pokemon-price-showdown-v1.webp`: 1200 × 800, 112,912 bytes.
- `public/images/games/pokemon-auction-house-v1.webp`: 1200 × 800, 116,384 bytes.

Showdown practice/daily directory tiles share the first self-hosted cover and its
reserved 3:2 image box. This replaces three external card images per tile with
one cacheable local image. The auction asset is prepared for its future route;
there is no playable auction link until the data/economy gates pass.

[Card-back source](https://akcemporium.com/cdn/shop/products/Pokemon_TCG_Card_Back_c389ec6b-c7c2-4c12-ac2d-75fed78e5fcd_720x.jpg?v=1639428695).
The built-in image editor rejected the reference edit. The background was generated
separately with the built-in tool, then composited with the original reference;
no separately billed API fallback was used. Original renders remain in ignored
`outputs/pokemon-art-options/`.

Background prompt: “An atmospheric empty trading-card hobby-shop interior at night,
used as a background plate for a website game cover. No cards, no logos, no text,
no people. Foreground is a dark midnight-blue felt gaming table viewed almost
straight on with a little perspective. Background has softly focused illuminated
glass display cabinets, dark wood shelving, subtle steel ceiling beams and a few
out-of-focus blue practical lights. Restrained graphite and deep signal-blue
palette, realistic material texture, cinematic but quiet lighting. Clear empty
central foreground for a separately composited subject. Wide landscape 3:2,
polished photographic illustration, low visual clutter.”

## Separate producer and reader controls

`prepare-deployment.mjs` now accepts two independent, default-off options:

- `--pokemon-game-stock true` sets `POKEMON_GAME_STOCK_INGESTION_ENABLED=true`.
  The existing shared live job admits game-only rows using the canonical source
  walk. It adds no separate importer or automatic history/graded/detail targets.
- `--pokemon-game-catalog true` sets `POKEMON_GAME_CATALOG_ENABLED=true`, allowing
  the existing reader to include a completed run's game-only stock.

Neither setting is inherited from a previous build. Both are staging-only during
impact review; preparing production with either enabled fails. The running live
job also rejects enabled admission outside staging before reading sources. Writer admission
does not automatically enable the reader or create a cron. The same run cannot
switch admission policy when resumed. The operator request body cannot turn on
the producer flag. Existing market minimum-count guards remain unchanged.

Runtime tests exercise the shared live job against an in-memory migrated database
with mocked upstream responses: absent/malformed flags do not admit stock, the
exact enabled flag does, bulk identities stay out of `catalog_products`, and an
attempted mid-run change fails before making more upstream reads. Existing tests
compare market prices/observations and verify completed-run publication guards.

## Read-only source audit

Reproduce explicitly with:

```powershell
node scripts/games/pokemon-bulk-audit.mjs 2585,22873,23228,24831
```

The script takes 1–6 explicit groups, reads source products/prices, compares the
normalizers on the same inputs and measures a hypothetical scoped payload. It
does not write feeds or D1. Source timestamp was `2026-11-08T20:05:45+0000`, unchanged
before/after the audit. If the timestamp is inaccessible, it stays unavailable and
the report explicitly declines cross-group freshness verification. A changing
timestamp rejects the comparison.

| Selected set | Existing market cards | Added game rows | Eligible game cards | Payload bytes | Gzip bytes |
|---|---:|---:|---:|---:|---:|
| Sword & Shield Base | 51 | 165 | 216 | 41,787 | 4,748 |
| Scarlet & Violet Base | 72 | 186 | 258 | 50,944 | 5,982 |
| Obsidian Flames | 54 | 176 | 230 | 42,158 | 5,004 |
| Delta Reign | 48 | 93 | 141 | 25,715 | 3,296 |

All 225 existing normalized cards were unchanged. The 620 additions comprise
307 Commons, 223 Uncommons, 73 Rares and 17 Holo Rares. Of these, 606 use Reverse
Holofoil, 13 Normal and one Holofoil: the first release intentionally preserves
the highest-positive-price supported subtype. These are exact-printing prices,
not non-foil bulk estimates. Artwork was structurally eligible, not live-probed.

These four sets do not establish full-catalog size, deployed Worker CPU, D1 query
cost or a complete market parity proof. The local normalization pass took roughly
0.4–2.0 ms per set; that is a desktop diagnostic. Bulk adds upserts and can extend
checkpointing enough to refetch source groups, even though both populations use
the same source walker. Do not equate the lack of a second importer with zero
additional upstream requests or database work.

## Activation gate and next implementation

1. Prepare a concrete staging-only admission run, private backup and captured
   baseline of catalog counts, prices, history/signals/metrics populations and
   current daily archives. Obtain authorization before remote activation/ingestion.
2. Enable the producer only, with staging cron still absent. Start a fresh source
   run; do not flip the flag within an existing checkpoint. Use the protected
   operator in bounded batches, recording rows, requests, writes and completion.
3. Verify expected bulk count, exact printings and full market parity. Confirm
   the complete eligible game pool fits the current 50,000-row/16 MB limits and
   measure D1 reads and Worker preparation cost. Do not silently widen limits.
4. Only after parity/completeness pass, enable the reader and check metadata,
   selected scopes, source dates, error behavior and existing daily immutability.
5. Proceed with Pokémon collection generation/investigations and stable NPC role
   mapping, then calibrate by selected eras/sets with actual bulk prices. Reuse the
   shared engine and UI incrementally; preserve all Riftbound saves and outcomes.

Remote admission, ingestion, pricing refreshes and production are unchanged by
this implementation. Validation/release evidence is recorded after the full gate.

## Validation

`npm run check` passed: production build, 733 passing unit tests, one existing skip,
lint with no new warnings, typecheck and all 198 Chromium checks. The final browser
run used no retries. Showdown cover screenshots were reviewed at desktop/mobile
widths in both themes; the cover loads as one 1200 × 800 self-hosted image in its
reserved 3:2 box. Existing singles/sealed, accounts, articles, daily archives and
Riftbound game journeys passed. The read-only source audit was rerun successfully
after ensuring it imports only the shared pure normalization layer; its focused
lint check was also clean. Unrelated TODO edits, image and article drafts remain
outside this change.
