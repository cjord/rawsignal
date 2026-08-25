# ADR 001: OpenAI Sites now, Cloudflare-native later

## Status

Accepted on 2026-08-25.

## Context

Raw Signal currently runs on OpenAI Sites and reads generated JSON feeds. Price history is fetched on demand and cached only within a Worker process. The product needs durable catalog records, daily observations, derived 7/30/90-day metrics, and Hot Buy/Hot Sell signals. A later move to direct Cloudflare hosting is planned.

## Decision

- Keep the React/vinext application on OpenAI Sites for now.
- Add one logical D1 binding named `DB`; Sites owns the current physical resource and deployment wiring.
- Use Cloudflare-compatible D1 SQL, migrations, and Worker request boundaries so the same database model can move to a directly managed Cloudflare Worker later.
- Keep R2 disabled. Card and product images remain source URLs; Raw Signal does not own image blobs.
- Store money as integer USD cents and percentage changes/distances as integer basis points. Preserve missing source values as SQL `NULL`.
- Treat product IDs and explicit printing/condition values as identities. Do not merge products by name.
- Record ingestion runs and publish refreshed data only after a run succeeds. Repeated ingestion of the same source snapshot must be idempotent.
- Retain generated JSON as the application read path during the transition. D1 becomes the application source of truth only after a populated database is compared with the current feeds and the cutover is approved.

## Data ownership

D1 contains catalog identities, current prices, sealed MSRP, dated observations, derived metrics and signals, plus ingestion and refresh metadata. Device preferences remain in browser storage, and images remain externally hosted.

## Daily ingestion

The daily job has four transactional phases: create a run, stage or upsert catalog and current prices, upsert observations and derived metrics/signals, then mark the refresh successful. Readers continue using the previous successful snapshot until the final phase completes.

OpenAI Sites configuration currently declares the D1 resource but not a scheduled trigger. While Sites remains the host, the existing refresh scripts remain the controlled ingestion mechanism. At direct Cloudflare cutover, bind the same `DB` database to the Worker and configure a daily Cron Trigger for the ingestion entry point. Do not add an unauthenticated refresh endpoint as a workaround.

## Migration and rollback

- Migrations are additive by default and committed in `drizzle/`.
- Inspect generated SQL and apply it to a local empty database before deployment.
- Export or snapshot production data before destructive migrations.
- Keep generated JSON available until D1 counts, nullability, and representative histories agree with current feeds.
- Failed ingestion runs do not advance `refresh_state`.

## Consequences

The immediate deployment gains a durable schema without changing visible market data. Some duplication remains temporarily during backfill and comparison. The future Cloudflare move changes resource ownership and scheduling configuration, not the domain schema or application contracts.
