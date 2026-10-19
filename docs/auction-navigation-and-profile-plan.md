# Auction Hub, Inventory Page and Profile Studio — plans only

## Persistent Auction Shell

Current auction links use full document navigation, and each route renders its own
Games shell/background. Switching to client links alone would not guarantee that
duplicated route shells stay mounted. The user explicitly requested **planning,
not implementation**, for changing this behavior.

Proposed sequence:

1. Introduce a shared nested layout for `/games/riftbound-auction/**`: persistent
   Auction Card Backdrop, Auction Hub Navigation and common header. Route bodies
   update inside it. Remove duplicate shells from those bodies.
2. Use client-side links for internal navigation and retain working direct URLs,
   browser Back/Forward and external/share links. Verify vinext's nested-layout
   behavior before committing to the migration. Do not add route `loading.tsx`.
3. Keep account identity/save boundaries separate from decorative state. Reuse a
   public catalog provider, but retain revision-protected owner-scoped progress.
   A profile route must not inherit another user's wallet.
4. Move focus to the new page heading; announce page changes, preserve sensible
   per-route scroll and retain keyboard/touch navigation. Respect reduced motion.
5. Active auction time continues across navigation; do not reset a clock, award
   winnings twice or silently waive leave/investigation fees. Preserve cancelled
   entry drafts. Review whether navigation away requires the existing leave warning.
6. Test all direct routes, snapshot fragments, account switches, daily runs,
   slow-network transitions, unsynced-save warnings and background mounting counts.

Only the route body should change; no full-document flash or background restart.
This does not mean market prices may remain stale indefinitely: use the separately
planned catalog version checks.

## Auction Hub Navigation

The five equally weighted links inside the next-auction area compete with entry
actions. Recommended location: **below the page introduction, outside Your Next
Collection**, with one compact, shared icon-and-text navigation strip:

- Play: Auction Lobby and Daily Challenge.
- Inventory: the dedicated sellable-card workspace below.
- My Showcase: display/edit your protected cards.
- Community: Leaderboard and Public Showcases.
- Guide: quieter secondary help link, rather than another primary action.

Show an active state and preserve descriptive text; avoid icon-only mysteries.
On mobile use an accessible wrapping strip or compact Community menu, not five
large competing buttons. Auction entry remains the strongest primary action.
Implement this together with—or just before—the persistent shell, after validating
the navigation hierarchy. Current links are unchanged in this release.

## Auction Inventory Page

Proposed route: `/games/riftbound-auction/inventory`. Reuse the new **Auction
Inventory Manager** rather than building another sell implementation. The lobby
would keep a concise cash/inventory summary and Manage Inventory link. Existing
inline management can remain during transition.

The full page can provide a larger filter/search workspace, quantities, current
sale values, protected showcase counts, pagination and confirmed selected/extras/
rarity sales. Encode shareable display filters/sort/page in the URL; keep selection
and pending confirmations ephemeral. Moving cards must use the existing single
owner save transaction. No new wallet store or real-world collection tracking.

The implemented inline version prioritizes large inventories: 24 printings per
page, search by name/set/printing, price availability, rarity/set filters, value/
unit-price/quantity/rarity/name sorting and scoped sales. Showcase rearrangement is
deliberately lower priority because it contains at most 20 cards.

## Profile Studio: clearer view versus edit

Separate these actions visibly:

- **View Public Profile**: read-only preview of exactly the public audience's data,
  with a Public/Private badge and clear Return to Editing control for the owner.
- **Edit Profile**: draft changes to public username, showcase and appearance;
  explicit Save/Cancel, with unsaved-change protection.
- **Sharing**: distinguish Copy Live Profile Link (account-linked/updates later)
  from Share Snapshot (frozen copy). Public visibility and leaderboard participation
  remain separate opt-ins. A missing public username links to Account Profile.
- **Account & Security**: private email, linked logins, recovery and preferences;
  never mixed into public profile editing or public previews.

Suggested sections: Identity, Showcase, Appearance. Keep security under private
Account Profile rather than suggesting it is public. Do not automatically publish
an edit or expose wallet/inventory simply because a preview exists.

### Profile Card Backdrop

Allow an optional chosen decorative card pool, distinct from showcase ownership
and the current auction lot. Proposed bounds: up to twelve canonical printing IDs,
same shared three-row layout, safe opacity/contrast, static/off options and reduced
motion respected. No arbitrary image URLs, custom scripts, unbounded CSS or upload
pipeline. Preview changes locally, then Save Appearance.

Open decisions before implementation: must selected decoration be owned, and what
happens after the last copy is sold? Recommended starting point is owned cards only
with an explicit fallback when ownership ends, but this needs user approval. Decide
whether frozen snapshot links include appearance at all; existing links must remain
compatible. Private profiles must not return unpublished custom selections through
public APIs. Store bounded IDs/settings only after the privacy/storage contract is
reviewed. No custom backdrop feature is implemented now.

## Order of work

First validate loading fixes and inventory tools; next public catalog caching;
then Auction Hub Navigation + Persistent Auction Shell + dedicated Inventory Page;
then Profile Studio controls and optional Profile Card Backdrop. Each can be scoped
and reviewed separately. Use the [feature names](ui-feature-map.md) in requests.
