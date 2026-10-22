# Auction navigation and loading polish — 2026-10-22

## Distinct feature names and implementation

- **Account Action Slot:** fixed-size neutral placeholder until the real session
  resolves, then Log In/Log Out. No remembered identity/auth guess or cached personal
  HTML. The action remains disabled while checking, with an accessible busy label.
  This stabilizes presentation; it does not skip the session request.
- **Games Directory Stable Mount:** only static `/games` joins the read-only market
  mount policy. Account bootstrap no longer remounts its tiles/DeferredImage state.
  The directory has no progress and no guest-play warning; actual games and private
  routes retain owner-scoped remounts/storage. Auction tile now says Play now.
- **Auction Hub Community Link:** a direct, same-document link to Leaderboard,
  with the shared market-style **Community View Switcher** centered on community
  pages. No duplicate My Showcase & Visibility shortcut; My Showcase remains in
  the hub. Inventory also has an explicit ← Auction House link. Timer behavior is
  unchanged; only the redundant browsing reminder is removed.
- **Auction Pagination Footer:** one component for inventory, backdrop editing
  and community directories. Previous left, page status center, Next right.
  Directories retain their visited cursors for real backward navigation; route
  changes reset cursor/results rather than reusing another view's state.
- **Community Tile Header:** Refresh is consistently top-right inside each tile,
  present/disabled during loading. Error and retry stay reachable. Privacy errors
  remove the prior public profile content; there is no new polling or endpoint.
- **Inventory Quick Sales:** always visible rather than collapsed, explicitly
  labeled Entire Inventory. Existing confirmation, current-price checks, active-
  auction disablement, unavailable-price handling and showcase protection remain.
- **Showcase Sharing & Visibility:** expanded content, not a disclosure. Viewing
  settings never opts anyone in or changes public visibility. The section stays
  below the gallery; independent loading must not block statistics or artwork.
- **Backdrop Loop Track:** explicit identical group/lane geometry independent of
  image dimensions and composited translation over one exact group. New artwork
  stays lazy/low-priority; after a URL decodes its twins become eager from the same
  resource, avoiding unready duplicate artwork at a repeat handoff. At most 18
  distinct decorative sources remain, with original/replacement fallbacks. This is
  public decoration, never the hidden lot. Reduced motion disables the animation.

## Virtual Net Worth — plan only: Auction Wallet Summary

Do not alter accounting, save formats or balances in this interface batch.
Keep the existing after-fee headline basis: cash plus the net sale value of all
owned cards, including protected showcase holdings. Explicitly distinguish that
total from cash spendable now; showcase cards must return to inventory before sale.

1. **Cash:** prominent immediately spendable virtual cash, with a quieter starting-
   bankroll comparison only if its definition is clear after resets/challenge rewards.
2. **Owned Cards:** show sellable inventory and protected showcase separately, with
   copy counts. Combine them only for the total owned-card value—not liquidity.
3. **Value:** label current market value separately from **Sale Value After 10% Fee**.
   Missing prices remain N/A, with known subtotal and unpriced-copy count. Never
   silently treat unknown holdings as zero or imply showcase cards are sellable.
4. **Status:** Between Auctions / Auction in Progress, price source date and account
   save/error state from existing data. Avoid new polling or implying that a pending
   bid was charged. Unknown source dates stay unavailable; load time is not price
   freshness. Normal saves need no new "up to date" banner. Daily challenge cash
   remains separate from the normal wallet.
5. **Actions:** Inventory and My Showcase links; secondary reset behind its existing
   explicit destructive confirmation. Consider retiring manual Refresh market only
   after automatic entry/page freshness and retry behavior are verified.
6. **Loading/accessibility:** reserve identical cash/count/value/status slots; render
   available balances independently of catalog/artwork. Use existing mono numbers,
   blue/purple/up/down tokens, large-text/mobile wrapping and tooltips for definitions.

Suggested layout: Cash | Sellable Cards | Protected Showcase, with a compact total
and status/freshness row below. Do not add another headline that sums net sale value
and gross market value together. Verify cost-basis/profit terms separately: game
net worth is not the same as lifetime auction profit.

## Verification and boundaries

Regression checks target delayed member/guest bootstrap, stable button geometry
and tile identity, exact game-owner isolation, loop-boundary positions and decoded
twins, back/next cursor requests, route state, large text, both themes and phone/
desktop widths. Ordinary market pages remain covered by the complete gate because
the account control is shared. No real account writes, ingestion, new dependencies
or migration. This request does not authorize a push or deployment.

### Local verification

Final complete gate passed: production build, 672 unit passes (one existing skip),
lint/type check and all 163 Chromium journeys. The 21 existing complexity warnings
remain; none was added. The focused 25-case suite passed after an initial local
Worker-runtime startup error before tests began. A later partial gate was stopped
to add the selected-tab/privacy regressions; only the final complete gate is evidence.

New checks prove stable account-slot geometry and retained Games tile/art nodes
through member/guest bootstrap, actual game-route owner isolation, clone readiness
and sub-pixel seam equivalence across repeated/resized loops, left/center/right
footer alignment, real previous-cursor navigation, same-document community switching
and no request when reselecting the current view. Privacy-error checks clear the
old profile and inspection state. Existing sale confirmation, showcase protection,
market-selector restoration, history stability and large-text/Full-view suites pass.
Visual review covered desktop/phone and dark/light captures. Loop tests establish
repeat geometry/readiness, not universal real-device GPU frame pacing.

Application changes remain local: no GitHub push, live account actions, staging or
production deployment. Virtual Net Worth is a plan only. Existing unrelated
editorial/backlog edits are preserved. Evidence remains ignored under
`outputs/auction-polish-validated-check.log`, `outputs/auction-polish-focused-retry.log`
and `test-results/`.

### Follow-up authorization

The subsequent user request approved a cash-first **Auction Wallet Summary** and
explicitly authorized pushing the combined changes to GitHub and deploying to
staging. The earlier local-only status above describes the prior validation, not
the new release. [Selected design, accounting and release verification](auction-wallet-summary.md).
