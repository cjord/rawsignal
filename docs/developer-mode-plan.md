# Developer mode — proposed, not implemented

Decision recorded 2026-10-16. Add a developer-mode option to Settings **on staging
only**, default off. Do not expose it on production while the site has no user
accounts. Accounts alone would not authorize production diagnostics later: require
an explicit product decision and an authenticated developer role first.

## Boundaries before implementation

- Use trusted server environment configuration (`ENVIRONMENT=staging`) to decide
  availability. Do not infer permission from a hostname, URL flag, browser storage,
  a hidden control or a client-supplied environment value.
- Omit the production toggle and all diagnostic response fields. A forged
  `raw-signal-developer-mode` preference must do nothing on production. Any future
  diagnostic endpoint independently requires authorized staging access (for example
  Cloudflare Access plus server validation); a visible toggle is not authorization.
  This plan does not authorize provisioning Access, endpoints or infrastructure.
- Store the opt-in locally under `raw-signal-developer-mode` with staging scope;
  never put the setting or sensitive diagnostics in shared URLs. Keep an obvious
  persistent “Developer Mode” indicator and a quick way to turn it off.
- Read-only inspection first. No upstream refresh, ingestion job, schema operation,
  cache purge, secret display, security bypass or write action from this toggle.
- Redact tokens, verification secrets, account/database identifiers, personal
  information, raw request headers and other users' private clues. Prefer safe
  summaries over raw payloads. Do not add a general-purpose query console.

## Useful inspection areas

| Surface | Proposed information | Data/cost constraints |
|---|---|---|
| Auction House | Seed/theme, admission weights, copy caps, true collection value, per-NPC observed facts, estimate/prior/uncertainty/personality/social multipliers, expected vs actual bid, settlement math and timers | Inspect the existing solo-browser state; no new market calls. A debug-used session must be visibly marked and isolated from any future competitive scores/economy. Never send multiplayer private clues to spectators or other seats. |
| Singles / Sealed rows and details | Published source date, row/history snapshot match, printing/condition keys, cache tier/age, missing-data reason and exact historical comparison cutoff | Reuse payload fields; fetch extra details only on explicit inspection, bounded and cached. Never change sort or refresh prices on hover. |
| Signals and regime | Qualification/rejection evidence, confidence inputs, strictness cutoffs and v1/v2 provenance | Read existing evaluation output. Debugging is not permission to promote the challenger. |
| Set heatmap | Snapshot age/version, eligible/total printings, exclusions, baseline dates, subset folding, coverage gate and median input counts | Read stored snapshot metadata, not a fresh visitor-triggered history scan. |
| Pack EV | Pull-rate source/version, rarity pool counts/priced coverage, slot expectations, exclusion adjustments and missing-rate reasons | Show current calculation inputs; distinguish gameplay odds from pack pull rates. No silent estimates for uncurated rarities. |
| eBay panel | Cache age, accepted/rejected match reasons, language/printing checks, safe affiliate-link validation, sampled listing vs broad-result counts | Existing cached response only. No extra Browse calls, item-detail fan-out or secrets. |
| Data freshness / ingestion | Safe published readiness markers, job age, checkpoint progress and stale/fallback reason | Authorized staging-only, read-only, bounded memoized summaries; never expose the staging job token or a job trigger. Staging remains cron-less. |
| Client performance | Request counts, duplicate fetches, bounded timing/error summaries and image fallback reasons | Explicit opt-in, bounded in-memory buffer, no external telemetry or personal data by default. |

## Auction-specific behavior

Hidden auction information is the most useful initial demonstration. Keep normal
players' interface unchanged. Prefer a separate diagnostic drawer with labelled
facts vs estimates rather than replacing visible game values. Revealing all cards
or manipulating clocks/seeds is cheating assistance, so isolate debug progress
(separate save namespace or a clearly disposable simulation). Define that boundary
before enabling the mode; do not silently contaminate an existing wallet. Existing
solo-browser storage is already inspectable and is not an anti-cheat boundary.
Public multiplayer, when implemented, must keep authoritative lots, cash and sealed
bids on the server regardless of any developer UI.

## Cost and performance contract

Off must add no API calls, D1 reads/writes or hidden polling. On should initially
reuse already loaded fields. Any new server inspection needs an explicit action,
request deduplication, tight record limits, expiry, authorization and a measured
budget. Never re-enable sales ingestion, graded spending or eBay calls as a side
effect. Deactivating the drawer stops diagnostics and clears transient buffers.

## Proposed implementation phases

1. Confirm staging access policy, production exclusion tests and debug-save rules;
   implement the staging-only Settings gate and a minimal read-only provenance panel.
2. Add solo Auction House inspection and an offline seeded simulation view. Show
   ordinary and rare-profile encounter/loss distributions with sample size and date.
3. Add heatmap, EV, leaderboard/signal and cache diagnostics as small independent
   read-only panels after measuring call cost.
4. Revisit production access only after accounts/roles exist and the user explicitly
   approves it. No automatic production rollout.

Acceptance tests: production never renders or activates the feature even with a
forged local preference; direct unauthorized debug requests fail closed; secrets
and other players' private data are absent; off adds zero network/storage activity;
on obeys request budgets; ordinary saved games remain intact; keyboard, touch,
desktop/mobile, light/dark and reduced-motion behavior remain usable.
