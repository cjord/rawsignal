# Auction UI feature names

Use these names in change requests and release notes to distinguish similar-looking
surfaces. Ask which surface is intended if the target would otherwise be ambiguous.
This is a naming reference, not a change to the repository's agent instructions.

| Feature name | Exact scope |
| --- | --- |
| Auction Lobby | The main Auction House screen before an auction starts. |
| Auction Card Backdrop | The decorative three scrolling rows of faded card artwork shared by auction pages. Never the hidden auction lot. |
| Auction Collection Grid | Cards in the current auction, including public/private reveals and the final revealed collection. |
| Auction Inventory Manager | Sellable virtual cards owned through Auction House; search, sorting, selection and sales. Not Collectr imports or real collections. |
| My Showcase | The owner's protected, editable 20-card display. Copies must return to inventory before sale. |
| Public Auction Profile | The account-linked public username, statistics and opted-in showcase. No wallet or private inventory. |
| Showcase Snapshot | A frozen, self-contained share link; not the live account profile. |
| Account Profile | Private account username, authentication and account settings. |
| Auction Hub Navigation | Local compact icon-and-text tabs: Play, Inventory, My Showcase, Community and Guide. Not deployed yet. |
| Persistent Auction Shell | Local nested auction layout preserving document/background across internal navigation. Not deployed yet. |
| Auction Inventory Page | `/games/riftbound-auction/inventory`; full virtual inventory workspace with URL-backed display filters. Local, not deployed. |
| Catalog Snapshot Cache | Experimental version-aware public catalog cache. First slice is local, off by default, not activated. |
| Market Snapshot Status | Shared owner-page loading/source/date/retry feedback; legacy feeds explicitly lack a source date. Local, not deployed. Not hidden collection value. |
| Inventory Loading Shell | Reserved overview/filter/action structure while account and prices resolve; disabled sales and failure/retry states. Local. |
| Auction Loading Shell | Reserved lobby wallet, entry choices and statistics before saved progress is ready; no fake wallet values. Local. |
| Data-First Artwork | Nearby card images schedule independently of the window load event; metadata/prices never wait for unrelated images. Shared image component, local. |
| Legacy Catalog Reuse | Auction-only public memory store: one eleven-file wave, five-minute reuse on internal navigation and last-good retry. Not the versioned compact endpoint. Local. |
| Community Burst Protection | Default-off platform hooks for coarse anonymous community reads and owner-scoped account writes; not a global quota or market-wide limiter. Local. |
| Community Moderation | `/admin/community`: audited, confirmed, revision-checked public Hide/Restore; never private wallet/inventory changes. Local, 0028 pending. |
| Saved Account Export | Private server-owned cloud documents, basic profile and community visibility/appearance; not pending device drafts or auth secrets. Local. |
| Performance Benchmark / Read Cost Meter | Opt-in guest browser sampling and metadata from existing staging catalog SQL reads; no visitor telemetry or extra SQL. Local. |
| Auction Bootstrap Response | Proposed owner-only combined initial state response. Planning only. |
| Profile Studio / Profile Card Backdrop | `/games/riftbound-auction/profile`; owner preview and Save/Cancel cosmetic editor for up to 12 Riftbound catalog printings, independent of ownership. Local, not deployed. |

Plans: [loading and inventory](auction-loading-and-inventory.md),
[catalog cache](auction-catalog-cache-plan.md),
[combined response](auction-bootstrap-response-plan.md),
[navigation, inventory page and profile controls](auction-navigation-and-profile-plan.md).
