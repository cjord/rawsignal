# Daily games and result sharing

## Decisions — 2026-10-16

Daily challenges are casual, browser-persisted games. No verified leaderboard,
accounts, real-money rewards or anti-cheat claims. Both reset at midnight UTC.

- Auction: existing $2,500 five-auction run (3 free, 2 paid), fixed 10% auto-sale
  fee, 25% of positive profit credited to the normal wallet, no cap.
- Showdown: 10 Normal rounds (2 choices) and 10 Hard rounds (3 choices), one
  attempt per mode/day/browser. Each mode has independent answers and review
  position. Switching modes and reloads preserve both; neither is restartable.
  No Showdown-to-auction wallet reward was requested or added.
- Games has two dedicated Daily Challenge tiles, reusing the established game
  artwork with daily labels. Unlimited practice and normal auctions remain intact.

## Share options considered

| Option | Strength | Limitation | Decision |
|---|---|---|---|
| Copy emoji/text | Small, easy to paste into Discord/social posts, no card spoilers | Limited detail | Implemented |
| Portable results URL | Rich stats/history/artwork, no per-user server record or write | Self-reported; generic social link preview, depends on archived daily snapshot | Implemented |
| Stored short link | Very short URL, custom social-card previews possible | Per-share storage, abuse limits, retention/privacy policy and write endpoint | Deferred until accounts/clear demand |
| Downloadable result image | Easy visual attachment | More rendering/accessibility work; not interactive | Possible follow-up |

Share Results opens a preview dialog with Copy Results, Copy Results Link and the
device share sheet where supported. Clipboard failure leaves selectable text;
cancelling native sharing is not an error. Sharing never posts automatically.

Showdown text has date, mode, score, best streak and ten green/red squares in two
rows of five, in play order. Auction text has five outcome squares, auctions won,
net profit and bonus. Card names, choices and prices are absent from Showdown text.
The linked page explicitly warns about detailed spoilers and unverified scores.

## Portable link contract

`/games/results#<base64url JSON>` contains version/game/date plus ten choice
indices, or five small auction receipts. No wallet, inventory, profile, full save,
free text, image URLs or executable markup goes into a link. Size/shape/date/index
validation runs before loading; React renders escaped names from the shared
manifest. The page is noindex and never changes game progress or credits rewards.

The URL fragment is not sent to the server in the page request. This is portability,
not confidentiality or proof: anyone receiving it can read/change the result data.
Do not use it as a verified score or trusted financial record. Links remain on the
environment that generated them (staging links use staging, production links use
production); the same date may have different snapshots across environments.

Auction receipts capture the winner's roster index, winning bid, player investigation
spend, player loss-share credit, final bidding round and buyout flag at settlement.
They append once in the same browser-save transaction as automatic sales. The viewer
derives exact frozen lot values, sale fees, entry costs, ending cash, profit, bonus
and top five unique cards won with quantities. Cards were auto-sold, not added to
normal inventory; card prices are per-copy market values before fees. An old local
run without five receipts does not get a fabricated rich share link.

## Shared lineups and archive reads

- `daily_auction_manifests` (migration 0022): five frozen lots, prices, seeds and
  market priors per UTC date, plus explicit rival names so adding future NPCs does
  not rewrite archived winners. Entry/intro honors those pinned rivals; cancelled
  normal drafts pin them too. Existing normal progress remains version-compatible.
- `daily_showdown_manifests` (migration 0023): both 10-round modes and frozen prices
  in one row/date. `drawPriceRound` retains 70% same / 25% similar / 5% random rarity
  preference; it falls back when stock cannot support a preferred grouping. Used
  card IDs are avoided across rounds when sufficient compatible stock exists.
- Shared `db/game-catalog.ts` reads the fully published Riftbound catalog once on
  initialization; no paid API or new ingestion/cron job. Existing regular-art
  substitutions apply to Metal/Best Of. Unpriced/missing-URL cards do not enter.
  Showdown also excludes indistinguishable printings with conflicting prices.
- Current-day first use initializes each game's manifest with an immutable
  conditional insert and returns the persisted winner after concurrent requests.
- `/api/auction/daily` and `/api/showdown/daily` accept optional `?date=YYYY-MM-DD`
  for results pages. Invalid/future dates are rejected. Past dates **only read**:
  they never create, backfill or regenerate a missing snapshot from today's prices.
  Missing archives show unavailable, not invented results.
- Successful current responses cache for up to 5 minutes, capped at UTC midnight;
  past rows cache 10 minutes at the existing edge layer. Failures are non-cacheable.
- Today's snapshots are created on first use, not necessarily from a midnight
  market refresh. Staging's catalog remains deliberately stale, clearly separate
  from the newly dated game lineup. Same-day redeploys cannot replace persisted lots.
- Daily artwork failures show Retry Artwork without privately rerolling choices.
  Before a new shared snapshot is inserted, selected artwork is checked against
  the HTTPS TCGplayer CDN: bounded image-header reads reject missing/403 images,
  malformed files and the known 400×570/200×285 placeholders. Only invalid rounds
  or lots are rebuilt; valid selections remain intact. Temporary source failures
  abort initialization without publishing an unchecked lineup. Archived rows are
  never changed by this check. Redirects and arbitrary catalog hosts are refused.
  Daily API edge keys include deploy identity without a D1 signature lookup.

## Cost and integrity

One new Showdown snapshot row/day, separate from the auction snapshot row/day.
Initialization performs catalog readiness/catalog reads plus one conditional
insert and a winner-row read; concurrent first visitors can repeat those reads.
Existing snapshots need one indexed-row read per cache miss. Copy/share adds no
per-share write; opening a rich link adds one cacheable archive read. No per-answer,
per-round, completed-sale, graded or eBay calls. Game state stays browser-local.

Artwork preflight adds CDN fetches only during first-use snapshot creation, not
paid price-provider calls. Checks deduplicate URLs, run at most six concurrently,
read at most 64 KiB per image and have an eight-second timeout. Each initializer
has a hard 600-uncached-check budget; exceeding it returns unavailable/retry and
does not publish. Per-isolate results cache for one hour (valid) or five minutes
(missing); concurrent first visitors in different isolates may repeat checks.
There is no artwork cache table, cron, or extra D1 write. Stored snapshots still
take one indexed row read per edge miss and no artwork preflight.

Limits are bypassable by clearing storage or another browser. Cross-tab revisions
guard ordinary stale updates; they are not an account-level lock. Midnight expires
uncompleted attempts. Completed results can still be shared from their stored page
until a new day replaces the browser's active daily save; already-copied links
continue to work while the server archive remains available. No automatic archive
deletion is introduced; revisit retention if growth warrants it.

## Release

Local complete gate passed: 528 node tests passed (one skipped), 71 Chromium
journeys passed, production build/lint/typecheck passed; 21 existing complexity
warnings and none introduced. Tests cover both modes, persistence, empty/expired
snapshots, share validation/spoiler-free text, fixed rival identities, archive
read-only behavior, copied-result viewing without save mutation, and the full
five-auction sale/reward flow. Desktop/mobile dark/light result pages reviewed.

Application `4529fae` and artwork hardening `b1c22de` are pushed on
`feature/set-rarity-heatmap`. Staging version
`e5b2db5e-e726-4670-b942-e886b9d6498a` is deployed at
<https://raw-signal-staging.raw-signal-watch.workers.dev/games>.
Migrations 0022 and 0023 were applied after the initial staging deployment and
verified; each game has one stored snapshot for 2026-10-16. Production remains on
`7a4cbb6` / `c076ac77`; its two migrations remain pending explicit authorization.

Live staging passed all ten Normal and ten Hard Showdown rounds, frozen choices,
share previews/result viewing without save mutation, all five auction receipts,
automatic sales, exact reconstructed ending cash and reward credited once. The
auction settlement diagnostic forced affordable NPC bids only inside its isolated
test browser to exercise all five wins; no server/game balance data was modified.
All four Games tile images and five rich-result card images loaded. Desktop/phone,
dark/light screenshots reviewed; no browser errors. The complete gate also covers
normal games, Singles/Sealed, filters, history, EV and heatmaps.

### Approved staging-only artwork repair

The first live lineup exposed product 709749 (Mind Rune (Vendetta)) returning CDN
403, not a usable photo. After explicit user approval, the original two Oct-16
staging snapshot rows were saved to the ignored local recovery file
`backups/daily-games-20261016/original-staging-lineups.json`, alongside a D1 recovery
bookmark. After the fix deploy, exactly those two date-keyed rows were deleted and
regenerated through the shared checks. Both endpoints returned 200; first creation
took 2.34 seconds (Showdown) and 2.90 seconds (auction). No other dates, production
records, normal wallets or inventory were touched. Originals remain recoverable.

Staging attempts started before this one-time repair hold the old browser-local
manifest and must restart to use the replacement. Reset **daily progress only**:
do not clear the normal auction save, cash or inventory. Future days initialize
with the checks automatically; ordinary deployments never regenerate stored days.
