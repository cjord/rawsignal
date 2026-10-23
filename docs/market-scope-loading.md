# Market Scope loading — 2026-10-21

## Names and observed failure

**Market Scope** is All / Pokémon / Riftbound / One Piece. **Product Type** is
Singles / Sealed. A remembered market is device-local navigation state; this work
does not add a remembered Product Type or sync navigation to an account.

A read-only staging browser trace observed one document request but two main-content
mounts for Cards, Sets and Metrics. Cards selected Pokémon → Riftbound → Pokémon →
Riftbound; Sets/Metrics selected All → Riftbound → All → Riftbound. Cards requested
freshness and its selected catalog section twice. This was not a second document
navigation or evidence of stale market prices.

AccountProvider changed its entire child wrapper key from `initial` to the resolved
guest/owner. Initial scope also rendered defaults before effects restored device/URL
state. Cards independently restored URL state and then invoked a market-switch
handler, potentially resetting explicit filters and normalizing the URL repeatedly.

## Local implementation

- A small SiteAccountProvider identifies an explicit allowlist of public market
  paths. Their wrapper key remains stable during account initialization; games,
  collections, buy lists, imports and account/admin pages retain owner-keyed isolation.
- Public market selection/data loading does not wait for session/recovery requests.
  Account write controls (favorites, set stars, display settings) remain disabled
  until account resolution. Existing account/conflict failures still block writes;
  no automatic save replay, owner merge or public caching of private data is added.
- One pure resolver chooses valid explicit URL market, then supported remembered
  market, then the surface default. Cards resolves this before deriving rarity
  defaults; query/sort/printing filters are not reset by a simulated user switch.
- Until browser scope is resolved, the existing controls retain their space but no
  false selection/slider is shown. Initial restoration inserts the correct highlight;
  deliberate user selections retain the normal transition. No timeout/image wait or
  route-level loading.tsx is introduced.
- Catalog/signal loading waits for resolved scope. Sealed landings no longer start
  the hidden Singles catalog loader. URL normalization preserves raw shared-link
  strictness and uses replace rather than adding a landing history entry.
- Owner-backed preferences refresh when account identity resolves without remounting
  the public page. Explicit view-only strictness/Scalper links remain view-only.
  Synthetic account-storage hydration is distinct from a real Scalper toggle and
  does not erase scenario inputs. Appearance controls follow the resolved theme.

## Verification and limits

Pure tests cover URL precedence, unsupported markets, per-surface fallback, dependent
rarities, preserved filters and the public/private path boundary. Browser fixtures
hold the account response while exercising Cards, Sets and Metrics: one selected
market, one mount, no repeated catalog batch, settings blocked until ready, and
market controls usable before auth. Additional checks cover explicit links, Back,
account strictness, sealed/scalping links, and both themes at 1440/390 widths.

Five focused browser journeys and sixteen focused unit/source checks passed. The
complete `npm run check` passed: production build, 655 unit tests (one skip),
131 Chromium journeys, type check and lint with 21 pre-existing complexity warnings
and no new warnings. Selector screenshots were reviewed at desktop/mobile sizes in
both themes. No push/deployment is requested in this task.
These are controlled local tests, not a new deployed timing benchmark,
physical-device verification or a claim that all remaining page loading is eliminated.
No server/auth query, ingestion pass, database migration or Cloudflare resource is added.

## Staging release and reassessment

On the user's subsequent release request, the full gate passed again (655 unit
tests, one skip, 131 browser checks, 21 existing lint warnings/no new warnings).
Source commit `be40c34` was pushed to `codex/accounts-and-collections` and deployed
to staging as `98299ef7-23bd-4e1e-83c8-0c5bbee8eb5e`. Production was not deployed.
Existing account/identity/save bindings and feature flags were preserved; remote
inspection confirmed no staging cron. No migration or data repair was performed.

Live delayed-session checks confirmed one mount/one correct market selection on
Cards, Sealed, Sets and Metrics, public content usable before account resolution,
and account write controls still gated. Desktop/mobile dark/light checks passed.
Measured feed requests fell 4→2 for Riftbound Cards, 6→3 for Pokémon Cards and
10→3 for Sealed, with no unrelated Singles feeds on Sealed. These counts include
freshness requests; they are not counts of D1 queries or billed Worker executions.

The initial All-market body on Sets/Metrics still changes after hydration;
eliminating the second mount did not eliminate that separate layout shift.
The deployed timing comparison and remaining work are recorded in
[staging reassessment](market-scope-staging-reassessment-2026-10-21.md).
