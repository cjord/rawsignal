# Cloudflare cutover runbook

Status: the cutover completed on 2026-08-28 (see the final section). Production is the `raw-signal` Worker on `rawsignal.cards`, staging is the cron-less `raw-signal-staging` sandbox, and OpenAI Sites is dormant as the rollback path. The gates below are the historical checklist that was followed; they remain the pattern for any future environment promotion. Do not reuse production data or change hostnames during preparation.

## Environment boundaries

| Environment | Runtime | Database | Traffic |
| --- | --- | --- | --- |
| Dormant rollback | OpenAI Sites | Sites `DB` binding | None (retained only as a rollback path) |
| Cloudflare staging | `raw-signal-staging` Worker | `raw-signal-staging` D1 | `workers.dev` and version preview URLs |
| Production | `raw-signal` Worker | `raw-signal-production` D1 | `rawsignal.cards` custom domain (workers.dev off) |

`cloudflare/environments.json` stores only non-secret names. Account IDs, database UUIDs, tokens, generated deployment configs, exports, and backups must stay outside Git.

## 1. Account prerequisites

Authenticate Wrangler and create isolated databases only after the Cloudflare account and target account ownership have been confirmed:

```powershell
npx wrangler whoami
npx wrangler d1 create raw-signal-staging
npx wrangler d1 create raw-signal-production
```

Record the returned D1 UUIDs in the deployment environment or secret manager, not in this repository.

## 2. Build and generate a staging config

The vinext build produces the base Worker configuration. The preparation script converts it into an environment-specific config, binds static assets as `ASSETS`, selects the isolated D1 database, and clears all Cron triggers unless the run explicitly opts in (`--cron "*/1 * * * *"` or `RAW_SIGNAL_STAGING_CRON`, honored for either environment); neither environment inherits a schedule from the build, and production is where the guard cron runs. The Worker's `scheduled()` handler is a guard tick: it advances at most one checkpointed catalog batch when the deployed feed snapshot has not been fully ingested, continues an operator-started history backfill, and otherwise no-ops.

```powershell
npm run check
$env:RAW_SIGNAL_D1_DATABASE_ID="<staging D1 UUID>"
npm run cloudflare:prepare:staging
npx wrangler deploy --dry-run --config dist/server/wrangler.staging.json
```

The generated file is ignored by Git. Inspect it before deployment and verify that `triggers` is empty, `workers_dev` is true, the `DB` binding references staging, there is no production route, and the injected bindings are present: `images` → `IMAGES`, `version_metadata` → `CF_VERSION_METADATA`, and the service binding `COLLECTR_FETCH` → `raw-signal-collectr`. Production preparation also pins `EBAY_DELETION_ENDPOINT_URL` to the exact custom-domain callback URL; it is public configuration, not a credential.

## 3. Migrate and seed staging

Apply committed migrations to staging:

```powershell
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.staging.json
```

**Ordering rule for data migrations** (0007 and any future data-rewriting migration):
deploy the Worker FIRST, apply the migration second. Deploy-first leaves only a
transient window (old strings render until the migration lands, then self-heal).
Migrate-first is the dangerous order: an ingestion run from the still-deployed old
Worker can re-write the old values, and wrangler will not re-apply an
already-recorded migration — rows whose products later drop out of the upstream
feeds would keep the old strings permanently. If a migrate-first sequence ever
happens, re-run the migration's UPDATE statements by hand (they are idempotent)
after the deploy.

Do not enable a schedule yet. The staging Worker exposes `POST /__ops/staging-jobs` only when `ENVIRONMENT=staging`, requires the `STAGING_JOB_TOKEN` bearer secret, and returns `Cache-Control: no-store`. Configure the secret after the first staging deployment:

```powershell
npx wrangler secret put STAGING_JOB_TOKEN --config dist/server/wrangler.staging.json
```

Invoke catalog ingestion with `{"job":"daily","batchSize":80}` until the response reports `done: true`. The staging adapter caps catalog batches at 80 because each record performs multiple D1 operations and larger batches can exceed Workers' per-invocation API-request limit. The job checkpoints after every batch and does not publish `daily-market` readiness until every catalog record is written. Invoke history with `{"job":"history","batchSize":20}`; it uses an independent durable cursor and publishes `history-signals` only after all eligible products are processed.

Until those two readiness markers exist, the catalog and signal APIs intentionally retain their bounded feed fallbacks. The adapter is not a public administrative API: it is hidden outside staging (`ENVIRONMENT === "staging"` gate in `worker/staging-jobs.ts`), has no GET behavior, and uses constant-time bearer verification. The accepted outcome at cutover was to keep it shipped behind that runtime gate rather than replace it with a service binding or Workflow.

## 4. Prove API parity

After staging ingestion completes, compare the complete paginated catalog and facets against production:

```powershell
npm run cloudflare:parity -- --baseline https://rawsignal.cards --candidate https://<staging-worker>.workers.dev
```

Pass `--allow-feed-candidate` when the candidate is expected to still be serving the bundled feed (an incomplete ingestion), otherwise a feed-sourced candidate fails the check.

The parity command checks representative Pokémon and Riftbound Singles categories plus Pokémon, Riftbound, and One Piece Sealed catalogs. It fails when records, counts, or facets differ, or when the candidate API reports a fallback source instead of `database`.

Before cutover, also verify null handling, historical series, Hot Buy/Hot Sell eligibility, URL navigation, and representative desktop/mobile views manually.

### Cloudflare exceptions for automated testing

Verified 2026-10-14: the production domain challenged local Playwright requests with
HTTP 403 and a "Just a moment..." page. Security Events identified **Managed
Challenge by Bot Fight Mode**. A WAF Skip rule matching the observed IPv6 address
did not resolve it. The user added an **IP Access Allow** rule for that address,
scoped to `rawsignal.cards`, after which direct production browser and API checks
returned 200 and passed. Staging checks also passed.

Use the following procedure when automated tests are challenged:

1. Find the exact request in **Security → Events**, using its Cloudflare Ray ID
   when available. Inspect **Source IP**, **Service**, and **Rule** before changing
   an exception. A challenge occurs before application code and does not by itself
   establish a Worker failure.
2. Use the request's **public source IP**, rather than a private LAN address or an
   assumed IPv4 address. These tests run from the local desktop computer; IPv6,
   VPNs, proxies, or network changes can affect the outbound address. Cloudflare's
   event is the authoritative record for that request. IPv6 temporary addresses
   may change, so recheck the event if an existing exception stops matching.
3. If the service is ordinary **Bot Fight Mode**, create an **IP Access rule**:
   **Security → Security rules → Create rule → IP access rules**; enter the exact
   observed IP, select **Allow**, choose the current website (`rawsignal.cards`)
   only, and add a note such as `Local automated testing`. An IP Access Allow rule
   exempts matching traffic from additional security checks, so keep it limited to
   the trusted source and remove obsolete addresses. Do not substitute a broad
   IPv6 subnet or an account-wide allowance.
4. If the service is a WAF custom/managed rule or **Super Bot Fight Mode**, a
   matching WAF **Skip** rule can apply. Put it before rules that could terminate
   the request, enable **Log matching requests**, and choose the relevant skip
   options. **All remaining custom rules** covers the current ruleset;
   **All remaining custom rules in this phase** also covers later custom rulesets
   in that phase. Skip options include rate limiting, Managed Rules, Super Bot
   Fight Mode, and selected products such as Browser Integrity Check and Security
   Level. They do **not** skip ordinary Bot Fight Mode or override IP Access blocks.
5. Retest the actual production hostname with a fresh browser context. Confirm
   application content and API JSON as well as status 200; verify the controls,
   links, desktop/mobile behavior, and snapshot source date. A production version
   URL can validate the deployed code and production bindings, but does not prove
   the custom domain's zone security rules allow the request.

The `rawsignal.cards` zone exception does not govern staging's `workers.dev` URL.
Testing access does not change staging's no-cron policy or the protected ops
endpoint's bearer-token requirement. If the connected API token lacks custom-rule
or security-analytics read permissions, inspect the matching event in the dashboard.
No public IP addresses or credentials are stored in this runbook.

References: [Cloudflare bot false-positive guidance](https://developers.cloudflare.com/bots/troubleshooting/false-positives/),
[IP Access rule setup](https://developers.cloudflare.com/waf/tools/ip-access-rules/create/),
[WAF Skip options](https://developers.cloudflare.com/waf/custom-rules/skip/options/).

## 5. Backup and rollback boundaries

### 2026-10-14 shared-history release

Application commit `60b54d0` deployed first to staging, then production after staging
checks passed. Migration `0021_shared_history_snapshots.sql` was applied after each
deployment and verified in `d1_migrations`. Complete SQL exports and Time Travel
bookmarks were captured before mutation; exports, checksums and recovery metadata
remain under ignored `backups/` and must never be committed.

Population used existing dated observations only: 19,044 staging printing/condition
series (16,491 Near Mint singles variants; 2,553 Unopened sealed) and 19,085 production
series (16,481 singles variants; 2,604 sealed). Conditional updates populated missing
versions only when the metric row's `updated_at` still matched the read. No source
API calls, current-price changes, source/sales freshness advances, signal rewrites,
missing series or concurrent-write conflicts occurred. All saved snapshot IDs and
7D/30D/range metrics match their corresponding database fields (zero audit mismatches).

Final same-source deployments, after population, invalidated page caches created
during activation: staging `e83dc459-dffb-4837-abf0-ab8d8f2c2ac9`, production
`df0fb5f7-ad88-4b29-b3f1-e8a61b859ff1`. Production retains its custom domain and
guard cron; staging retains workers.dev and no cron. Browser/API checks passed on
both final URLs for every supported singles/sealed market, alternate-printing
history, matching row/chart figures, stable hover order/values, desktop/mobile
dark/light behavior and regular-rarity Metal artwork. eBay listing calls were
intercepted in the test browser only to avoid unnecessary quota spending.

Database files measured approximately 421 MiB staging and 471 MiB production
after population. The snapshot format bounds chart storage to 1Y plus its true
baseline and retains one previous version on subsequent changes; full observations
remain intact. Account-subscription inspection returned 403 with the connected
token, so no billing-plan change or claim of a newly verified subscription was made.
The recorded paid allowances remain in `docs/ingestion-scaling.md`; review storage
after the first previous-version rollover. Sales features remain paused.

Before any remote migration or production cutover, create an export in the ignored `backups/` directory and record a D1 Time Travel bookmark:

```powershell
npx wrangler d1 export DB --remote --output backups/raw-signal-before-cutover.sql --config dist/server/wrangler.production.json
npx wrangler d1 time-travel info DB --remote --config dist/server/wrangler.production.json
```

A Worker version rollback restores code, assets, and bindings; it does not restore D1 contents. A database rollback is a separate, destructive operation and requires explicit approval. Time Travel retention is finite, so exports remain part of the cutover checklist.

Avoid a percentage-based gradual deployment while hashed assets can differ between Worker versions unless version affinity has been deliberately configured and tested.

## 6. Production preparation

Production config generation requires both the production D1 UUID and an explicit hostname:

```powershell
$env:RAW_SIGNAL_D1_DATABASE_ID="<production D1 UUID>"
node scripts/cloudflare/prepare-deployment.mjs --environment production --route cards.example.com
```

Do not deploy this config until staging parity, backup verification, DNS ownership, Access/preview policy, monitoring, and a rollback window are approved.

For an eBay-enabled release, add `EBAY_DELETION_VERIFICATION_TOKEN` as a Worker secret
(32–80 characters, only letters, numbers, `_`, and `-`) without placing it in a file. The
existing eBay client ID and secret are reused to fetch notification public keys. Cloudflare
security must skip managed challenges for the exact `/api/ebay/account-deletion` path; do not
disable signature validation or broadly exempt `/api/*`. After deploy, register the exact URL
and token in eBay, then require both the GET challenge and test POST to succeed.

## Status — cutover completed 2026-08-28

All slices of this runbook are done. Final topology: production Worker `raw-signal`
serves `rawsignal.cards` (custom domain; workers.dev off; `ENVIRONMENT=production`;
guard Cron `*/1` — raised from `*/2` per todo M2 on 2026-08-31 and live since the
next production deploy; verified $0 against every billing meter) on D1
`raw-signal-production`; sandbox Worker `raw-signal-staging` keeps its workers.dev
URL and `raw-signal-staging` D1 with no schedule (stale by design — update only when
deliberately testing ingestion changes).

Execution notes from the split:

1. The production Worker was commissioned with `ENVIRONMENT=staging` + workers.dev on
   so the ops adapter could seed its database (live → details → history → metrics, plus
   a graded carry-over from staging); the cutover deploy flipped it to production shape,
   which disabled the adapter.
2. Fresh-catalog drift is real: products in build-time snapshots (details, history
   targets, graded carry-over) can be absent from a freshly ingested catalog. History
   batches now skip such targets (`skippedMissingCatalog`); manual seeds must filter
   by existing `catalog_products` rows first.
3. Wrangler moved the custom domain between Workers in one deploy — no manual dashboard
   release was needed.
4. Pre-cutover D1 exports and Time Travel bookmarks for both databases live in
   `backups/` (gitignored), named `*-2026-08-28-pre-cutover.*`.

Rollback order: re-attach `rawsignal.cards` to `raw-signal-staging` (its Worker and D1
are intact); restore from the exports or Time Travel bookmarks; dormant Sites last.
