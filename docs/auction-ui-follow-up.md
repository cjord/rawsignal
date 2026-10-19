# Auction, showcase and profile UI follow-up — 2026-10-19

## Gaps addressed

- Link-buttons and native buttons had different layout rules. Game controls now
  share centered text, sizing and focus feedback. Primary actions use restrained
  blue fills; sharing/community navigation uses purple, with the usual blue hover.
- Showcase directories were ordered by save date rather than collection value.
  They now rank current exact-printing market totals, counting each reserved copy.
  Incomplete prices are N/A, sorted last, with known subtotal/unpriced count visible.
  Auction leaderboard ranking remains lifetime net auction profit, separately opted in.
- Public identity had a second name field. A saved Profile **Username (Public)** is
  now authoritative. Provider names and email prefixes are never public fallbacks.
  Missing usernames lead to Profile; publication and signed-in snapshot sharing
  require one. Existing frozen links retain their immutable historical names.
- All auction surfaces share three decoded/fading decorative art lanes, independent
  of the hidden collection. A small generated URL-only pool comes from the existing
  bundled catalog (`scripts/games/build-auction-backdrop.mjs`); no upstream refresh,
  remote font, image generation or new catalog API request is needed for decoration.
- Valid cross-tab auction updates now use bottom-right notifications outside page
  flow. Actual invalid/full-storage/cloud conflict errors remain persistent inline.

## Loading and layout stability

My Showcase previously rendered save statistics before catalog names/prices, then
inserted an independently fetched visibility section above the cards. It now waits
for account scope, saved state and the catalog to settle, then reveals statistics
and cards together. In-page placeholders reserve the content area; card artwork
retains its natural reserved aspect ratio. Catalog failures exit loading explicitly,
keep prices unavailable, and offer Retry. No route-level loading file is introduced.
Sharing/visibility lives below the gallery in a collapsed native disclosure, so its
request cannot shift the main content while closed. Public profiles use the same
pending placeholders. This reduces multi-stage shifts, not a claim of zero CLS for
every variable-length name, error, image or user-expanded section.

Alternatives considered:

1. Short-lived client catalog cache: improves repeat navigation but needs published
   version/age invalidation and cross-account-safe ownership. Defer until measured.
2. Combined server profile payload for My Showcase: one response can coordinate save,
   canonical cards and visibility, but adds personalized server/read complexity and
   must preserve offline/guest/frozen-link behavior. A useful later optimization.
3. Wait for all artwork: rejected; slow/broken external images must not block data.

## Notifications

One root-level host displays up to three deduplicated, dismissible notices in a
polite live region. Settings offers 4, 8 (default), 15 seconds or Until Dismissed.
The message body is click-through so it cannot block a bid or other page control;
only its explicit dismiss button receives pointer clicks.
The timer pauses on pointer hover, keyboard focus and hidden tabs; remaining time
resumes afterward. The preference uses `raw-signal-notification-duration`, scoped
to the account while signed in, device storage for guests. Notices are ephemeral,
not saved/exported, and do not steal focus. Reduced motion disables fade animation.
Recovery/security confirmations are not replaced by disappearing notifications.

## Data/privacy and deployment

Hand-written migration 0027 adds nullable `auth_user.public_username`. There is no
automatic conversion of Google/Discord names. Existing public visibility is reset
off once so owners can explicitly save a public username and opt in again. Game
data, profile IDs, inventory and frozen share links are preserved. Clearing a
username also disables visibility. Username changes affect future live public reads.
The private update route is session-owned, exact-origin checked, JSON/size bounded,
and rejects foreign fields and control characters. Usernames are not unique handles.

The showcase directory adds a published-catalog readiness read and a bounded-per-
account selected-slot price join (up to 20 slots), not a price/history-source call.
It reads showcase arrays from opted-in game documents; aggregate cost grows with
the public population. There are **zero extra daily ingestion writes/API calls**.
Precompute/project selected slots before high-volume community rollout if read cost
requires it. Session bootstrap adds one username lookup when community is enabled;
an explicit username save updates one owner row. No per-visit price writes or cron.
Keyset pages remain live, so edits/prices can change ordering between pages.

Release order: full gate; commit/push; fresh staging-only config with community/tools
disabled; deploy; private export/bookmark; apply/verify 0027; enable existing flags
and deploy the same build. Preserve auth secrets, OAuth/email configuration and no
staging cron. Production is not part of this request. Disabling community/tools is
the safe code rollback; do not undo migrations or restore a database automatically.

## Suggested next improvements (not implemented)

- Showcase directory search, affordable/top-value filters and clearly dated price
  provenance alongside its current total; validate scale before adding more reads.
- A clearer profile preview/edit split, with account preferences and public identity
  grouped separately from security and recovery controls.
- Inventory filters/sorting and compact owned/displayed counts for large holdings;
  retain protected showcase copies and accessible drag/keyboard/touch behavior.
- A single measured, version-aware catalog cache if repeat-page timings justify it.
- Keep public moderation, API throttling, full-account privacy export and verified
  competitive scoring as release hardening work, not decorative UI polish.

## Validation and release evidence

The full `npm run check` passed: 585 node tests passed, one skipped; all 103
Chromium journeys passed; type checking passed, with only the 21 existing lint
complexity warnings. Coverage includes username ownership/consent, live exact-price
value ordering, duplicate cards, unavailable valuations, coordinated loading,
notification duration/hover/dismissal/click-through, existing games, and Singles/
Sealed desktop/mobile and theme regressions. An overlay interception found during
development was fixed and is now explicitly tested. The Guide request counter
distinguishes root market endpoints from the bundled decorative JSON module.

A private staging SQL export and recovery bookmark were saved before migration.
Staging deployment/migration and live verification are pending at this source commit;
production remains unchanged. Real authenticated visibility/username review uses
the owner's staging session; automated live checks do not send mail or alter accounts.
