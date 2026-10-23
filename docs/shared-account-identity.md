# Shared account identity, isolated environment saves

## Goal and boundary

The same verified Google, Discord or email-code identity can sign in on production
and staging. OAuth applications are reused; that alone does not share accounts.
`IDENTITY_DB` is a new identity-only database, never a second binding to production's
market/save database. Each Worker retains its own `DB` and recovery-wrapping
`AUTH_SECRET`. Only the identity authentication secret is shared.

Production supports public accounts. Staging account sign-in and every authenticated
account request require a verified allowlisted administrator. Anonymous market pages
are not an admin-only application. Staging must retain no ingestion schedule.

## What is shared

- Canonical user ID, verified email, login-provider subject links and authentication.
- Sessions stored centrally but tagged with their issuing environment, separate
  host-only cookie prefixes, and server-side environment checks. Signing into one
  site does not silently sign into the other.
- Shared email-code send budget and recipient cooldown.
- Shared account deletion and production-managed security controls.

## What remains separate

- Game saves, cash, inventory, showcase holdings, daily attempts and statistics.
- Favorites, Collectr imports, settings/preferences and public usernames/profiles.
- Recovery keys, recovery encryption, save revisions, sync telemetry and admin audit.
- Market data, ingestion schedules, moderation state and public community pages.

Each environment's `auth_user` is a minimal save-owner mirror keyed by canonical ID.
Mirroring preserves its local public username and does not merge records by email.
No read/write path from staging reaches production's market or save database.

## Security and deletion

Staging may sign in/out and read linked methods. Shared identity edits, linking,
account deletion and other-device revocation are production-only. Local profile
names, local exports, recovery and saves remain available to staging admins.
Production can list/revoke sessions across environments. No provider tokens appear
in device lists, management responses or exports.

Account deletion writes a durable identity-only outbox before deleting the canonical
user. Production purges local saves immediately; staging purges its mirror and FK
dependents during subsequent account activity (five tasks per bounded sweep, at most
once per minute per isolate unless explicitly forced). Failed deletions never purge
a still-existing identity. Public profiles additionally check canonical existence,
so deleted accounts are hidden even while local cleanup is pending. Guest storage
and previously shared frozen links are not deleted. Metadata-only admin audit IDs
retain their documented 90-day audit window. Private backups may retain historical
records until their retention window ends.

## Rollout procedure

1. Run the complete release gate. Commit/push that exact source before deploying.
2. With approval for private account data, export both environment databases to the
   ignored local `backups/` folder and record Time Travel bookmarks. Keep access
   restricted; never commit/export them to third-party tools.
3. Create the identity-only database. Deploy validated code with sharing disabled,
   then apply production migrations 0024–0028 and
   `drizzle/identity/0000_shared_identity.sql` to the correct bindings.
4. Copy only existing verified allowlisted admin user metadata and provider subject
   links, preserving IDs. Do not copy sessions, tokens, codes, recovery keys or
   saves. `scripts/cloudflare/account-identity-import.mjs` explicitly projects fields.
   Confirm source/destination IDs and links after import; fail on conflicts.
5. Preserve staging's recovery secret. Provision a new production recovery secret
   and shared identity secret without printing values. Reuse approved provider
   credentials; verify both providers' exact callbacks for each origin.
6. Explicitly bind `IDENTITY_DB` and activate shared accounts on staging. Validate
   guest behavior, non-admin rejection, headers, login links, isolated saves and
   recovery using the local three-database tests and live smoke checks.
7. Activate production after staging passes. Verify account flags, original market
   binding and minutely cron, restricted email sender, secret names, private routes,
   OAuth initiation, navigation and responsive login. Human sign-in remains necessary
   to confirm real provider consent and physical-device recovery.

The deployment generator defaults accounts/sharing/protection off, rejects an
identity binding pointing to the environment's save DB, uses a separate identity
migration directory, and explicitly clears staging crons.

## Live release — 2026-10-21

Application `77537b5` is pushed/deployed as staging `d049f771` and production
`be504bb9`. Accounts, shared identity, recovery, audit, moderation and separate
environment burst limits are active. Compact catalog cache remains OFF. Both original
market/save bindings and prior secrets are preserved; staging has no cron and
production retains `*/1`. Email is restricted to `accounts@rawsignal.cards`.

With explicit approval, both databases were exported privately, with Time Travel
bookmarks and SHA-256 manifests kept in ignored local folders. Production migrations
0024–0028 and the identity-only schema were applied after a disabled deploy; ledgers
were verified. Two verified admin identities and two provider links were imported
and compared to source, preserving IDs. No sessions, OAuth tokens, verification codes
or game saves were copied. Staging's recovery key is unchanged; production has its own.

Staging live checks passed admin-only access, guest private-route denial, restricted
identity mutations, both provider callback URLs, private headers and responsive login.
Five market catalogs and persistent auction navigation also passed. Production's
canonical APIs passed account flags, private access, public projections and provider
initiation/callback URLs. Its exact deployed preview passed desktop/mobile dark/light
login, Singles/Sealed and auction pages, persistent navigation, zero guest save writes
and zero page errors. All five production catalog samples now serve database data;
staging honestly retains stale-feed fallback. No ingestion was manually triggered.

The production custom domain still challenges the automated browser (HTTP 403,
Bot Fight Mode), while API checks work. No security rules were changed. Real provider
sign-in after migration and physical-device recovery remain human acceptance checks.
No live test emails or authenticated save writes were performed. Sign in again: old
sessions were not transferred, and production progress starts separately from staging.

## Validation and remaining work

Local verification (2026-10-21): `npm run check` passed the production build,
628 unit tests (one existing skip), lint/type checks and all 118 Chromium journeys.
After adding the narrow import utility, the complete unit suite passed again with
630 passing tests and one skip. Lint retains 21 existing complexity warnings and no
new warnings. The new account screen was reviewed in both themes on desktop/mobile.
Three in-memory databases exercise shared IDs, separate saves/recovery, staging role
revocation, cross-environment session rejection, deletion and immediate public hiding.
These are not real-provider consent or physical-device recovery verification.
Remote activation and verification are recorded above.

Disable account flags if activation fails; keep all databases and secrets. Do not
roll back to legacy staging authentication after new shared identities have been
created without a reconciliation plan. Worker rollback does not roll back D1.
Restoring a database is a separate destructive action requiring approval.

Remaining: physical-device recovery verification, retention/disclosure review,
verified email-change flow and provider unlink UI. Deletion cleanup is activity-led,
not a scheduled staging job; monitor the outbox backlog and add an independently
authorized maintenance mechanism if guaranteed wall-clock deletion becomes required.
