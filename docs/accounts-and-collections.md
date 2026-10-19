# Accounts and collections

## Status — staging testing, 2026-10-19

Branch: `codex/accounts-and-collections`, created from released main at `1a72935`.
Application source `9ead83e` is pushed and deployed to staging. Accounts remain
disabled by default but are explicitly enabled on the canonical staging hostname.
Production code, secrets, bindings and database have not been changed.

Staging version: `600ee3df-a0bf-4586-bd7e-033beaef7f3c`. Migration 0024 was applied
only after the initial disabled-account deployment. A pre-migration database export
and recovery bookmark were saved in ignored local storage. Five staging auth secrets
and the restricted-sender native email binding are configured; staging still has no cron.
The generated staging auth secret is retained in the ignored
`.secrets/accounts-staging-auth-secret` file; preserve it for future configuration.

Live checks passed: Google/Discord authorization initialization and exact callbacks,
Secure OAuth state cookies, private/no-store responses, guest save rejection,
login controls and Settings profile link, no guest uploads, desktop/mobile and both
themes, and absence of the optional third-party affiliate loader. These checks do
not complete provider authorization or prove client-secret validity during token exchange.

One staging sign-in-code email to the previously approved test address was accepted
by the native email binding. Inbox delivery and a complete email-code login still
need user confirmation. The earlier standalone Email Sending test was inbox-confirmed.
Automated local account tests continue to use mock email, not real recipients.

## Decisions

- Google primary, Discord secondary, six-digit email codes instead of passwords.
- Log In / Log Out beside Settings; Profile & Account inside Settings and `/account`.
- Account-owned preferences, singles/sealed/set favorites, buylist, current Collectr
  import, Auction House progress and practice/daily Showdown progress.
- New account progress starts at login. Guest saves remain on the device and are
  never uploaded, merged or replaced by cloud account data.
- Profiles are private. Existing frozen showcase/result links are explicit shares;
  signing in does not publish profile, wallet or inventory.
- Game saves remain client-reported casual progress, not verified competitive
  records. Accounts alone do not make daily rewards or multiplayer cheat-resistant.
- Game inventory is never treated as a real-world owned collection.

## Provider setup — keep credentials local

Use separate development/staging and production clients. Never paste secrets in
chat or commit them. `.secrets/` and `.dev.vars*` are ignored.

### Google

1. Open [Google Cloud Console](https://console.cloud.google.com/), select or create
   the Raw Signal development project, then open Google Auth Platform.
2. Configure Branding and an External audience. While Testing, add your Google
   account as a test user. Only basic identity/email/profile scopes are needed.
3. Create a Web application OAuth client. Add these exact authorized redirects:

   ```text
   http://localhost:3000/api/auth/callback/google
   http://localhost:4173/api/auth/callback/google
   https://raw-signal-staging.raw-signal-watch.workers.dev/api/auth/callback/google
   ```

4. Download its JSON to `.secrets/google-oauth-staging.json`. Do not commit it.

Production later needs its own client, consent/privacy information and redirect
`https://rawsignal.cards/api/auth/callback/google`. Follow Google's publishing
requirements before opening registration publicly.
[Google web OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).

### Discord

1. Open the [Discord Developer Portal](https://discord.com/developers/applications),
   create Raw Signal Development, then open OAuth2. No bot is required.
2. Add the same three redirect origins/paths above, replacing `/google` with
   `/discord`. Request only identity/email, not guilds or messages.
3. Save `.secrets/discord-oauth-staging.json` as
   `{"clientId":"YOUR_CLIENT_ID","clientSecret":"YOUR_CLIENT_SECRET"}`.

Production later uses a separate application and
`https://rawsignal.cards/api/auth/callback/discord`.
[Discord OAuth documentation](https://docs.discord.com/developers/topics/oauth2).

## Runtime and security boundaries

Better Auth 1.7.11 runs directly in the Worker with the existing D1 binding.
Required configuration: `AUTH_ENABLED`, exact `AUTH_BASE_URL`, random environment-
specific `AUTH_SECRET` (at least 32 characters), configured provider credential
pairs, and the native `AUTH_EMAIL` Email Sending binding. Local unit/browser tests
do not require real credentials. Production and staging must not share auth secrets.

For an authorized future deployment, use `send_email` with name `AUTH_EMAIL` and
`allowed_sender_addresses: ["accounts@rawsignal.cards"]`; provision credentials
as Worker secrets, never public variables. Actual sending from this binding still
needs live staging verification. The dedicated local Email Sending API token is
not read by application code or bundled into the browser.
[Cloudflare binding reference](https://developers.cloudflare.com/email-service/configuration/send-bindings/).

- Cookie-backed sessions; Secure on HTTPS; 30-day lifetime; no session cookie cache.
- Account deletion and provider unlinking use a ten-minute fresh-session check.
  Implicit provider linking is disabled; explicit linking requires the current
  account session and provider authorization.
- OTPs: hashed at rest, six digits, five-minute expiry, three failed attempts.
- General database-backed auth throttling plus one OTP request/IP/minute and
  one recipient/minute. Shared UTC send-attempt budget defaults to 100/day via
  `AUTH_EMAIL_DAILY_LIMIT`. No provider credentials or codes enter client storage.
- `/api/auth/*` and `/api/account/*` bypass public caches and return private,
  no-store responses. Public market HTML does not contain personal account data.
- The optional third-party eBay Smart Links loader is disabled whenever accounts
  are enabled. Explicit affiliate marketplace links remain available.
- Account saves require the actual session owner, exact origin, JSON, an allowlisted
  document key and a valid bounded payload. Single-statement revision checks reject
  stale writes instead of merging money/inventory or overwriting another device.
- Signed-in documents are memory-only in the browser. Logout reloads the app;
  account switches clear module caches. A non-secret identity marker alerts other tabs.
- Save failures freeze controls and keep pending values for retry/export, with an
  unload warning. There is no durable offline save queue yet: force-closing the tab
  can still lose unsynced changes. Do not advertise offline account play.
- Account export contains profile and saved documents, never OAuth/session tokens.
  Deletion cascades cloud documents; guest data and independently shared frozen
  snapshots remain outside that account deletion boundary.

## Calls and storage

Disabled accounts make no new browser account calls or account-table queries.
Enabled pages fetch one private bootstrap (session + all saved documents). Changed
domains issue serialized saves, coalescing identical values and queued changes to
the same key. Each save validates its session and atomically updates one document;
session refresh and auth throttling can add writes. This is separate from ingestion:
there are no new market-source calls, daily ingestion calls or scheduled jobs.

Ordinary documents have a 1 MB UTF-8 limit; current Collectr import 1.5 MB. Oversized
saves are rejected explicitly. No migration or auth overhead is incurred on ordinary
market API requests. Rate-limit/expired-verification retention needs a bounded cleanup
policy before public rollout; do not add an unbounded cron silently.

## Release sequence — requires authorization

1. Complete full gate; review account security, payloads, privacy and recovery UX.
2. Supply Google/Discord staging credentials; verify exact redirect configuration.
3. Commit/push when authorized. Deploy staging with accounts **disabled** first.
4. Apply 0024 to staging after deploy; configure environment-specific secrets and
   native email binding; only then explicitly enable staging accounts.
   Preparation requires `--accounts true --auth-base-url <exact HTTPS origin>`;
   without these options it disables accounts and removes the auth email binding.
   Provider client IDs/secrets and `AUTH_SECRET` are Worker secrets, never config vars.
5. Verify real OAuth, email delivery, logout/revocation, explicit linking, reload,
   account/device switching, game sync, favorites/imports, conflicts and deletion.
6. Production remains disabled until staging passes and production setup/deployment
   is separately approved. Apply its migration after a disabled deploy, then enable.
7. Rollback disables accounts without reverting/deleting account tables or cloud
   saves. Retain the auth secret for encrypted provider tokens and existing cookies.

## Remaining before public account launch

- Complete Google/Discord authorization and callback token exchange with the user;
  confirm email inbox delivery and complete an email-code login.
- Profile avatar controls and linked-method listing/unlink UX; verified email-address
  changes/recovery (currently disabled, not an unverified editable email field).
- Durable offline queue/recovery and richer cross-device refresh/conflict UX.
- Account-owned multi-import collection archive: current sync retains only the
  existing last-import view, not a history of every Collectr import.
- Privacy/terms/account deletion disclosures and retention/budget monitoring.
- The optional affiliate loader is already disabled in account-enabled environments;
  finish content-security-policy and other third-party script review before public launch.
  Existing shared-D1 backup procedures will also contain personal account data;
  define backup access, retention and deletion disclosures before launch.
- Full live account sync journeys; evaluate long game histories against document limits.
- Label restored practice-round prices with their saved-round provenance rather than
  implying that every restored card was repriced on the latest page load.

Local validation: `npm run check` passed with 560 unit tests (one skipped), 81
Chromium checks, type checking and lint (21 existing complexity warnings; no new
warnings). This includes mocked account UI and real auth-library/SQLite adapter
tests, not completed live Google/Discord authorization or inbox-confirmed native
Worker email delivery. Live staging smoke checks are recorded above.

## Next: real collections and monitoring

After auth/save reliability, introduce account-owned named real collections with
explicit printing, condition, quantity, optional cost basis and import provenance.
Support multiple Collectr imports with a preview/diff and deduplication decisions,
manual edits, singles/sealed favorites and collection history/value charts. Reuse
published market snapshots; missing prices stay unavailable, never silently zero.
Keep private by default, allow deliberate frozen or permissioned sharing later,
and design notifications/refresh costs before enabling background monitoring.
Do not blend game holdings, graded prices or different printings into owned holdings.
