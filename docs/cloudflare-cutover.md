# Cloudflare cutover runbook

OpenAI Sites remains the production host until the direct Cloudflare deployment passes every gate below. The first direct deployment must use a separate staging Worker and D1 database. Do not reuse production data, enable Cron, or change the production hostname during preparation.

## Environment boundaries

| Environment | Runtime | Database | Traffic |
| --- | --- | --- | --- |
| Current production | OpenAI Sites | Sites `DB` binding | Public production URL |
| Cloudflare staging | `raw-signal-staging` Worker | `raw-signal-staging` D1 | `workers.dev` and version preview URLs |
| Future production | `raw-signal` Worker | `raw-signal-production` D1 | Explicit custom hostname after approval |

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

The vinext build produces the base Worker configuration. The preparation script converts it into an environment-specific config, binds static assets as `ASSETS`, selects the isolated D1 database, and explicitly clears all Cron triggers.

```powershell
npm run check
$env:RAW_SIGNAL_D1_DATABASE_ID="<staging D1 UUID>"
npm run cloudflare:prepare:staging
npx wrangler deploy --dry-run --config dist/server/wrangler.staging.json
```

The generated file is ignored by Git. Inspect it before deployment and verify that `triggers` is empty, `workers_dev` is true, the `DB` binding references staging, and there is no production route.

## 3. Migrate and seed staging

Apply committed migrations to staging:

```powershell
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.staging.json
```

Do not enable a schedule yet. The existing daily-ingestion and history-backfill modules are scheduler-independent, but a protected staging execution adapter still needs to invoke them. Until a complete `daily-market` run and independent `history-signals` readiness marker exist, the catalog and signal APIs intentionally retain their bounded feed fallbacks.

## 4. Prove API parity

After staging ingestion completes, compare the complete paginated catalog and facets against the current Sites production API:

```powershell
npm run cloudflare:parity -- --baseline https://raw-signal-pokemon-watch.drdrrr.chatgpt.site --candidate https://<staging-worker>.workers.dev
```

The parity command checks representative Pokémon and Riftbound Singles categories plus Pokémon, Riftbound, and One Piece Sealed catalogs. It fails when records, counts, or facets differ, or when the candidate API reports a fallback source instead of `database`.

Before cutover, also verify null handling, historical series, Hot Buy/Hot Sell eligibility, URL navigation, and representative desktop/mobile views manually.

## 5. Backup and rollback boundaries

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

## Next implementation slice

1. Confirm the Cloudflare account and provision only the staging Worker/D1 resources.
2. Add an authenticated staging-only execution adapter for daily ingestion and history backfill.
3. Run migrations and seed staging; keep Cron disabled.
4. Prove database-backed catalog and signal parity.
5. Add monitoring and then enable a daily staging schedule.
6. Plan production hostname, backups, and cutover separately.
