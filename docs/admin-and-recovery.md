# Persistent recovery and management audit

## Status

Local implementation on `codex/accounts-and-collections`; not pushed or deployed.
Migration **0025_recovery_and_admin_audit.sql** is pending in both environments.
Neither remote databases nor Worker flags/secrets have changed for this work.

Validation on 2026-10-19: `npm run check` passed (572 node tests passed, one
skipped; all 93 Chromium journeys passed; type checking passed and lint retained
only the 21 pre-existing complexity warnings). Focused recovery checks used real
browser IndexedDB for close/reopen, account isolation, revision conflicts and
blocked-storage handling. Management pages were checked at mobile/desktop widths
in both themes. This is local validation, not live staging or production evidence.

## First management pages

| Page | Available information | Boundary |
| --- | --- | --- |
| `/admin` | Environment/feature flags, aggregate account/session/document counts, stored bytes and UTC email send-attempt budget | No names, emails, holdings, tokens, account impersonation or edits |
| `/admin/audit` | Time, opaque actor ID, effective role, action, access outcome, reason code and request ID; actor/action/outcome filters and keyset pagination | Read-only, 50 records/page, 90-day read window; no delete/edit/export-all endpoint |
| `/admin/data` | Published ingestion markers, source/finish dates and record counts; stored heatmap dates/algorithm versions | No refresh, backfill, regeneration or upstream market calls; missing streams remain unavailable |

Settings and the profile link to Administration only for admins. That is convenience,
not security: the Worker independently checks the session and verified-email admin
allowlist for every management HTML/RSC request and API read. Guests are redirected
to sign-in on pages (401 on APIs); members receive 403. Responses are private,
no-store, Cookie-varying, no-referrer and outside the public edge cache. No private
admin data is embedded in publicly cached market HTML. Management pages are noindex
and are not added to the sitemap.

Staging's intentionally stale data is labeled as expected. Environment scheduling
policy is not presented as proof of a working cron. Published markers are not a full
catalog parity/coverage audit. Snapshot dates represent the actual stored source,
not today's date. No automatic polling is added.

## Suggested next management areas

| Priority / area | Useful additional data | Safeguards before building |
| --- | --- | --- |
| 1. Accounts & Sync Health | Exact account-ID lookup, document revisions/sizes/update times, provider-link status and instrumented conflict/error counts | Require a support purpose and audit each lookup; metadata first, no full holdings/import payloads. Do not claim browser draft counts: encrypted drafts stay on the device. |
| 2. Catalog Quality | Missing prices/images/history versions, duplicate candidates, set/rarity coverage and existing Collectr match-tier review data | Bounded indexed queries; keep unavailable data unavailable, distinguish listings from sales, no automatic corrections or promotion of the signal challenger. |
| 3. Jobs & Budgets | Failed/latest attempts alongside published runs, sanitized error codes, stored provider-budget counters and migration readiness | No raw log dumps or secret-bearing upstream URLs. Separate viewing from running expensive jobs; preview and explicit approval before retries/backfills. |
| 4. Daily Games | Published manifest dates/versions, card counts, artwork validation health, reward/save anomalies once instrumented | No live answer keys, active hidden bids/clues, wallet resets or same-day regeneration. Previews use an isolated staging sandbox, never the real wallet. |
| 5. Access & Security | Reviewed role changes, session-risk summaries, sensitive exports/deletions and access alerts | Fresh sign-in, reason, server-derived actor/role, atomic action+audit for new mutations, retention/access policy. No impersonation in the first version. |

The recommended next page is **Accounts & Sync Health**, followed by **Catalog
Quality**. They help investigate real support/data problems without granting broad
destructive controls. Staging-only developer mode remains a separate future feature;
ordinary admin access does not turn it on.

## Audit contract and limits

- The first ledger records management data reads, authenticated member denials,
  and authenticated access to the user's own recovery key. Actor/role/request ID
  are derived on the server. Clients cannot submit audit rows, actor IDs or roles.
- `allowed` / `denied` describe authorization, not proof that a subsequent database
  read, email or network request completed. Existing login/logout, profile editing,
  account deletion and role-configuration changes are **not** comprehensively
  instrumented by this first slice. Do not call it a complete security event trail.
- Repeated read/denial events coalesce per actor/action/outcome/minute. Guest probes
  are not written to D1, avoiding an anonymous log-spam spender; Cloudflare security
  logs are the separate source for those attempts. This is not an exact request counter.
- Logging must succeed before protected management data is read. Failure denies
  that read. A logging failure never turns a member denial into access.
- Fields are fixed and small: no arbitrary query/body/header data, email addresses,
  session/OAuth tokens, recovery keys, collection contents or imported portfolios.
- SQLite prevents updates to the ledger and deletion of records younger than 90 days.
  App APIs expose neither editing nor deleting. A database owner can still alter/drop
  tables: this is append-only application storage, not externally tamper-proof logging.
- Read APIs omit records older than 90 days. `pruneExpiredAdminAudit` is an operator-only
  cleanup primitive capped at 100 rows/call. It is not called by an API or a new cron.
  Actual deletion therefore needs an approved bounded maintenance operation. Define
  backup retention and account-deletion disclosures before production activation.
- Role grants currently come from the operator-managed `AUTH_ADMIN_EMAILS` secret.
  Changes need an operator/Cloudflare audit record until a reviewed in-site mutation
  flow is implemented. This ledger cannot reconstruct earlier grants retroactively.

These exclusions follow [OWASP's logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## Recovery design

1. A signed-in account with recovery enabled obtains its own key through an
   origin-checked, authenticated POST. The caller cannot specify another account.
   Keys are random per account; D1 stores only wrapped keys with an account-bound,
   domain-separated HKDF/AES-GCM wrapping key derived from `AUTH_SECRET`.
2. The browser imports the key as non-extractable Web Crypto material and retains
   it in memory only. It encrypts valid pending documents plus original revisions
   into IndexedDB. Fresh random IVs and authenticated metadata bind ciphertext to
   account, draft ID, key ID, creation time and expiry. No login/session token is stored.
3. Pending drafts are written before cloud-save attempts. Latest values coalesce
   by document within a tab; each opened tab has a separate stream. Original revision
   checks remain authoritative. Successful server acknowledgement removes the draft;
   a lost response can be recognized by matching the already-saved cloud value.
4. After closing/reopening a tab, sign in to the same account to unlock its drafts
   under Profile → Device Recovery. Close other tabs first. Recover fetches fresh
   cloud versions before loading changes; any changed revision blocks recovery.
   The user can export/discard instead. A loaded safe draft uses the existing Retry
   Save action. Separate drafts are never combined, and money/inventory are never merged.
5. The source recovery copy is retained until the adopted draft is acknowledged
   by the server. A conflict or failed write does not delete it. Exports are explicit
   **unencrypted** private downloads. Account switches forget the in-memory key;
   another account cannot unlock or upload those drafts.
6. Recovery validity is seven days, capped at 10 MiB of encoded encrypted data and five
   streams per account/device. Full storage does not silently discard an older draft.
   Expired ciphertext is pruned opportunistically when recovery storage is opened;
   without another site visit it can remain on disk, but cannot be decrypted through
   the recovery flow after expiry. No background timer can guarantee physical deletion.

The Protect Device Storage button explicitly asks the browser for persistent storage.
It reports the actual grant/denial and does not promise that manual clearing, private
browsing, browser crashes, disk failure or account deletion cannot lose data.
IndexedDB commits request strict durability; that is not a substitute for export
backups. See [MDN durability](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/durability).

This is **recovery**, not a fully offline app: cold-start sign-in/key retrieval needs
connectivity, and a failed cloud save still freezes edits. An online event retries
only transient current-tab failures, never conflicts or expired sessions. Daily UTC
expiry, auction timers and reward rules are unchanged. No service worker or cached
market-price feed is introduced.

Encryption protects leftover storage when signed out; it does not protect an unlocked
page from XSS or a malicious extension. Blocked/full browser storage falls back to
the existing tab/manual-export path with a visible warning, not a false persistence
claim. Old tab drafts are cleared only after encrypted persistence succeeds.

**Preserve `AUTH_SECRET`.** Changing it without a key rewrap plan makes existing
wrapped recovery keys unreadable (and already affects encrypted auth tokens).
Account deletion cascades the server recovery key, so its encrypted browser drafts
cannot subsequently be unlocked. Export any important drafts before deleting.

## Calls and rollout

- No new market-source requests, ingestion batches, schedules or public market API work.
- Recovery-enabled account bootstrap adds one private key POST, session validation,
  a key-row read and a coalesced audit insert attempt. First enrollment also writes
  the wrapped key and rereads the winning row to handle concurrent enrollment.
- IndexedDB/encryption writes are local. Recovery review adds a fresh session/document
  read; accepted restores use the ordinary revision-checked cloud save path.
- Admin data loads only on opening/refreshing/applying a filter/page. Each authorized
  read has session checks plus an audit insert attempt and bounded management queries.
  Overview counts/byte totals scan account tables; preaggregation may be needed at scale.

For a future authorized release: full gate → commit/push → deploy with tools **off**
→ apply 0025 to the chosen environment after deployment → explicitly enable with
`--accounts true --auth-base-url <exact origin> --account-tools true`. The preparation
script clears inherited audit/recovery flags by default. No new secret is required;
retain the existing environment's `AUTH_SECRET`. Do not enable production accounts,
create a cron or provision services as an incidental part of this work.

Rollback disables the two tool flags while retaining keys and encrypted drafts. It
does not undo account saves, drop audit tables or change challenge snapshots. Review
key rotation, audit cleanup/backup retention, device expiry and true multi-browser
recovery in staging before approving production use.
