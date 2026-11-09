# Pokémon game stock — staging admission

November 9, 2026. Follow-up to the [bulk/artwork implementation](pokemon-bulk-and-artwork-2026-11-09.md), performed after explicit authorization to back up and test staging admission. This is operational evidence, not a production rollout or an auction-game release.

## Result and boundaries

The complete Pokémon game stock passed admission and is readable on staging.
The reader is enabled; the temporary producer is disabled. The staging release
is `5a0e4526`, using the previously validated application source `15af730`.
No new application code, migration, generated feed, schedule or production
deployment was introduced during this admission run.

| Measure | Result |
|---|---:|
| Newly admitted game-only stock | 13,888 cards |
| Eligible English game pool, including existing market cards | 27,411 cards |
| Available game sets | 210 |
| Full game response | 4,926,965 bytes |
| Current admission limits | 50,000 cards / 16 MB |
| Published ordinary market catalog after authorized refresh | 19,389 records |
| Source timestamp | November 8, 2026, 20:05:45 UTC |

The ordinary market catalog previously contained 19,245 records. Its increase
reflects the authorized source refresh, not admission of game-only bulk into
market boards. Bulk remains in its separate game stock table. All prices are
real supported-printing market prices; a Reverse Holofoil price must not be
described as the price of the ordinary non-foil card.

Production remains unchanged. Staging still has zero scheduled jobs. Existing
daily archives were not regenerated, so today's existing challenge can retain
its earlier frozen pool. This admission does not create Pokémon Auction House;
it completes its real-bulk prerequisite.

## Backup and completeness

A private full staging database backup was saved locally before mutation:
641,092,480 bytes. The export, download URL, credentials, generated environment
configuration and detailed operational evidence remain ignored and are not
included in this report or the repository.

An independent read-only source audit used the same pure normalizers and
eligibility policy, with the producer off/on compared against the same source.
It covered all 221 eligible Pokémon source groups; the source timestamp was
unchanged before and after inspection and matched final publication.

The audit expected 13,543 ordinary category-3 market cards and 13,888 game-only
cards. The ordinary source population includes 20 cards excluded by English game
eligibility; it should not be labeled an entirely English game pool. The final
27,411-card eligible snapshot matched the independently reconstructed snapshot,
including exact identities, printings, artwork references and cent prices.

Final parity checks passed:

- All 13,543 ordinary Pokémon market rows matched the stock-off normalization,
  including market/low/median/high prices and product identity fields.
- All 13,888 game-only rows matched their expected identities and prices.
- All 1,012 ordinary set-rarity statistics matched the independent reference.
- No game-only IDs appeared in catalog products, market price observations,
  market metrics, production signals, shadow signals, graded prices or product
  details. These seven overlap checks each returned zero.
- No admitted stock card had a missing or nonpositive market price.
- The full eligible snapshot fit both existing admission limits without widening
  either limit. Incomplete stock was not exposed while ingestion was running.

## Ingestion and resource cost

The protected staging operator completed 636 acknowledged batches, reaching its
final checkpoint and publishing the fresh source only after completion. The
producer recorded 13,888 stock rows processed/written and 19,389 ordinary catalog
records. Its 447 duplicate decisions are normalization/checkpoint statistics,
not a count of duplicate cards admitted.

The operation took approximately 94 minutes from the first to last acknowledged
batch, including recovery waits. Several client connections reset. Recovery
waited for a stable persisted checkpoint before resuming the single writer;
batch size was reduced from 80 to 40 records. No parallel writer, new cron or
automatic production ingestion was added.

Measurements and their limits:

| Measurement | Observation | Interpretation |
|---|---:|---|
| Staging Worker ingestion window | 660 requests; 6,714 subrequests; 0 reported errors | Worker-wide window, not an isolated per-batch counter |
| Worker CPU, ingestion window | p50 172.095 ms; p99 426.740 ms | Cloudflare analytics; does not include client/network wait |
| Staging database window | 183,865 reads; 114,613 writes | Query counts include validation and other staging traffic |
| Database rows read / written in window | 7,039,451 / 340,969 | Includes validation reads and index maintenance; not incremental bulk-only cost |
| Database query-batch time | p90 1.14 ms | Aggregate, not full ingestion duration |
| Exact cold game-loader SQL | 3 queries; 358,536 rows read; 0 writes | Read-only reproduction of the service's SQL |
| Cold loader SQL duration | 468.277 ms | Database-reported total for these three queries |
| Same remote control-plane request | 1,665 ms | Includes transport; not page response time |

The cold loader inspected 28,224 raw candidates, then filtered to 27,411 eligible
English game cards. It includes completeness checks; removing them to improve a
benchmark would weaken admission safety. The service caches prepared/raw data,
and the browser reuses the selected pool between rounds.

The long ingestion wall time compared with short individual SQL execution
suggests sequential request/transport overhead is an important contributor.
This is an inference, not a measured attribution of every delay. Before any
production admission, review atomic write batching and checkpoint round trips
under an explicit cost budget. Preserve restart safety and exact parity.

## Live reader and browser verification

The reader was activated only after complete parity passed. The producer was
then disabled, all original bindings/plain configuration preserved, and zero
staging schedules reconfirmed.

First-observed HTTP measurements from one client:

| Request | Bytes | Time |
|---|---:|---:|
| Pokémon scope metadata | 11,633 | 1,445 ms |
| Entire Pokémon pool | 4,926,965 | 450 ms |
| Entire pool, repeated | 4,926,965 | 208 ms |
| Sword & Shield Base, 216 cards | 41,813 | 184 ms |
| Delta Reign, 141 cards | 25,741 | 204 ms |
| Scarlet & Violet era | 814,621 | 208 ms |
| Riftbound scope metadata | 770 | 348 ms |

These are successful observed response times, not a controlled cold-browser
comparison or a latency guarantee. Database source, completeness, source date
and exact full-pool hash were verified. Riftbound did not acquire Pokémon stock.
The small reader analytics window reported seven Worker requests, zero errors,
CPU p50 79.501 ms and p99 311.573 ms; the sample is too small for capacity claims.

Isolated Chromium loaded the real staging practice page without fixtures or an
account, selected Sword & Shield Base, played Normal, advanced a round and
switched to Hard. It verified two/three choices, actual loaded artwork, printing
labels, hidden pre-answer prices, zero page errors and no additional catalog
requests between rounds (two catalog requests total for setup/pool). Desktop
dark and mobile light screenshots were inspected. This is browser automation,
not physical-device or Safari acceptance. Full-catalog artwork was structurally
checked; this run did not fetch every individual artwork URL.

The previously completed source release gate remains the code-validation
evidence: 733 passing unit tests, one existing skip, lint/typecheck/build and
198 Chromium checks. This operational run adds live-data acceptance; it does
not claim those suites were rerun against every remote card.

## Protected data and next steps

After reader activation, exact whole-row hashes of the three existing daily
manifest tables still matched the pre-operation baseline. Account-document
count, total revisions and most-recent update timestamp were unchanged. The
account check is aggregate evidence, not a full byte audit of private saves.
Production's deployed version remained unchanged; no mutations targeted its
database. All 13 unrelated local files in the preservation manifest also matched
their original hashes.

The next feature batch can implement Pokémon collection generation and
investigations against this stock, followed by stable rival-role mapping and
selected-era/set balance simulations. Do not assume a collector-only pool's
auction valuations transfer unchanged to bulk-rich sets. Auction daily rewards,
wallets, inventory and community isolation remain later acceptance gates.

The producer remains disabled after this deliberate refresh. A future ordinary
staging refresh must not silently advertise old stock as complete for its new
source run; the existing same-run completeness gate remains authoritative.
Production admission requires separate authorization and a reviewed cost plan.
