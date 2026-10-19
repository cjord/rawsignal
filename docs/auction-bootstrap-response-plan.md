# Auction Bootstrap Response — proposal, not implemented

Goal: coordinate account progress and public market readiness, avoiding fragmented
loading without leaking personal data through shared caches.

## Options

| Approach | Benefit | Cost / drawback |
| --- | --- | --- |
| One private response with owner state and the full auction catalog | One coordinated cold payload; simple version pairing. | Repeats public cards in private responses; cannot use a shared public cache. |
| Public versioned catalog + small private bootstrap (recommended) | Public cache reused across pages/accounts; private state stays isolated. | Two coordinated responses initially, with explicit readiness state. |
| Server-rendered owner bootstrap | Can remove a client round trip on direct loads. | Requires an intentionally private, uncached page path; existing publicly cached pages must not embed account data. |

Prefer the public [Catalog Snapshot Cache](auction-catalog-cache-plan.md) plus a
small private bootstrap. Fewer HTTP calls are not automatically fewer D1 reads or
faster paint; compare payload and cache behavior before choosing the one-response option.

## Proposed private contract

Return only the authenticated owner's auction save/document revision, public
username, necessary visibility/preferences, catalog version metadata and capability
flags. Statistics already live in the auction save; do not copy them into another
authoritative record. Keep the DTO explicit and validated. Do not include other
owners' private data, credentials, recovery encryption keys or daily answer keys.

Use authenticated same-origin GET, `Cache-Control: private, no-store`, and exclude
the route from the public Worker/colo/page cache. Never key private responses only
by URL or trust an owner ID submitted by the browser. Guests keep their isolated
browser save and use the public catalog; public profiles/snapshots do not call this
owner endpoint.

## Loading, saves and failures

1. Resolve identity and the owner-scoped document once, then load/reuse the public
   catalog against the returned version. Expose account, save and market readiness
   separately without showing a temporary empty wallet/statistics record.
2. Reveal stable structural controls immediately; coordinate valued inventory and
   statistics at readiness. Do not wait for decorative artwork to load.
3. Preserve the existing revision compare-and-swap save boundary, device recovery,
   conflict/export controls and cross-tab notifications. Never replace unsynced
   changes simply because a bootstrap response arrives later.
4. Cancel or ignore stale responses on identity changes. Do not merge guest progress
   into an account or show the previous owner's values during a switch.
5. Keep a retained entry draft, active auction and daily frozen snapshot unchanged.
   A missing catalog is unavailable, not a zero-price conversion.

## Cost and staged implementation

GET adds no writes. Session authorization, document reads, visibility reads and
catalog readiness/catalog reads remain real work even if packaged in one response.
Count statements and rows with the chosen repository implementation before giving
an exact estimate. Avoid querying profile visibility unless the current view needs
it; reuse document data already loaded by the session if that is sufficient.

No migration is assumed for a prototype: existing account documents hold progress.
Only add storage if an independently reviewed contract needs new durable state.
First instrument current loading; then implement the public catalog contract;
compare a bootstrap prototype behind a staging flag. Test slow account/market
responses, identity switches, partial failures, unsynced offline drafts, public
cache isolation and version consistency. Require complete release checks and a
separate deployment approval. This document does not authorize implementation.
