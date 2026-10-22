# Auction lobby entries and Backdrop Loop Track

## Scope and naming

- **Daily Challenge Entry Tile:** a full-row neutral tile inside Your Next
  Collection, beneath Bilgewater and Piltover. It navigates to the challenge rules;
  it does not fetch a lineup, charge a fee or consume an attempt. Pending account/
  save resolution reserves the same tile with a disabled control.
- **Auction Hub:** retain Play, Inventory, My Showcase, Community and Guide.
  Remove the extra Normal Auctions / Daily Challenge text-link row. The daily
  rules page retains its return link.
- **Backdrop Loop Track:** three decorative lanes, with two identical groups per
  lane, independent of the hidden lot. This change repairs image lifecycle and
  resize phase, not auction generation or market loading.

No accounts, saves, catalog feeds, daily snapshots, pricing, fees or game balance
are changed. The first implementation was local only; the subsequent request
authorizes pushing and deploying these changes to staging, not production.

## Site-Native Auction Accents — approved refinement

The mockups did not match the rest of Raw Signal closely enough. Graphite + Signal
Blue was the closest, but the agreed direction is **existing plain site surfaces**,
not a newly introduced graphite palette. The subsequent preview review approves
neutral smaller wallet/statistics tiles while retaining the **green Wallet** and
**blue Your Next Collection** outer backgrounds. The green cash headline and red
reset remain. Ordinary counts/rates/spend use neutral text; financial gains/losses
retain green/red values. No new color tokens or palette family are introduced.

Guiding decisions:

1. Use existing surface/control/line/text tokens for outer panels and most metrics.
   Avoid independent fills and saturated borders for every section.
2. Use blue for selected states, focus and primary actions; green/red where the
   number actually communicates a gain/loss, and red for reset/leave actions.
   Keep rarity colors scoped to cards and rarity-specific information.
3. Let layout, headings and spacing distinguish wallet, entry and statistics
   sections. Show semantic color on the relevant number or small accent instead
   of turning every containing panel into a color block.
4. Review the main page beside Cards/Metrics in dark and light mode, at desktop,
   phone and large-text sizes. Remove category-colored small metric fills, not
   the approved green/blue parent backgrounds or meaningful rarity semantics.

The new Daily Challenge tile uses the current neutral control surface.

Approved component treatments:

| Feature | Plain default | Limited emphasis |
| --- | --- | --- |
| Auction Wallet Summary | Retain green parent/cash surfaces; neutral total, inventory and showcase tiles | Cash headline remains green; reset remains red |
| Your Next Collection | Retain blue parent background | Blue entry/focus states; fee label stays readable without a separate badge background |
| Your Auction Statistics | Neutral section and metric backgrounds | Green/red net results; zero and ordinary counts neutral |
| Auction Hub | Existing site control surfaces | Blue selected/focus state only |
| Card galleries | Existing neutral tiles and natural artwork | Preserve rarity borders and value effects; do not flatten meaningful card cues |

This preserves a little auction character in artwork and card treatments while
letting ordinary site layout do most of the organizational work. It does not
require new color tokens or changing every shared game component.

## Backdrop diagnosis and implementation

The previous read-only staging probe retained DOM nodes, animation objects and
sources across 75 seconds, including the 70-second CSS boundary. It did not prove
a recurring network reload at the seam. However, local error injection changed
54/54 rendered sources: filtering a broken URL compacted the indexed candidate
list, reassigning healthy cards across every lane.

The new implementation replaces that filtering with **18 fixed logical slots**.
An app-side resource store owns assignments and readiness; rendered repeated
groups subscribe to one snapshot. A rejected source changes only its assigned
slots. Reserve artwork comes from the existing weighted decorative sample, with
at most 36 candidates total. A small catalog can repeat healthy artwork instead
of leaving holes. Complete exhaustion remains invisible rather than showing a
broken-image placeholder or retrying forever.

Each source tries the verified 200px TCGplayer thumbnail, then its original once.
The resource is published only after image decode and placeholder validation.
The existing non-CDN 400×570 missing-art sentinel remains rejected as well.
Both repeated groups receive the same resolved URL; subsequent errors use the
same replacement assignment. Healthy slots are never cleared or refaded when a
different image fails. Rejected artwork itself is hidden until its replacement
decodes; this is preferable to retaining a known broken image.

Only active logical slots load, with four concurrent low-priority image attempts
and a five-second timeout per attempt. Candidates are unique, failures are bounded,
and unmount aborts outstanding work. StrictMode restarts ignore stale completions.
No foreground data or action waits for these decorative resources. Unchanged
catalog contents reuse the resource store despite incidental React renders.

ResizeObserver tracks each repeated group width and adjusts the existing lane's
animation time to preserve its directed pixel offset modulo the new loop width.
It does not restart the animation object. This prevents a phase-proportional
translation jump; actual card reflow on major viewport changes remains expected.
Reduced motion still disables scrolling and image fade transitions.

## Verification and remaining limits

Unit checks cover the four-load limit, decode-before-publication, shared fallback,
one-source replacement isolation, small/empty/failed catalogs, active-slot loading,
abort/restart and forward/reverse resize math. Browser checks cover identical
gapless groups in both themes at desktop/phone sizes, reduced motion, actual
image-error injection, retained image/animation identities across four forced
cycles, resize offset preservation, and Daily Challenge keyboard/navigation flow.

The final complete local `npm run check` passed: production build, **683 unit
passes** (one existing skip), lint/type check and **168 Chromium checks**. The
21 existing complexity warnings remain; none was added. Desktop/phone and both
themes were reviewed, with reduced-motion, failure isolation, loop seams, resize,
shared fallback and same-document navigation assertions retained.

The first broad run caught a caption-selector assumption after adding the daily
number badge; the test now checks each tile's actual caption, still requiring
no internal caption border/background/shadow. The next run caught a real legacy
400×570 placeholder regression outside the main CDN. That rejection was restored,
covered by a new unit test, and passed the original browser regression unchanged.
The final full gate above includes both corrections. Evidence is ignored under
`outputs/backdrop-stable-release-check-verified.log`,
`outputs/backdrop-stable-focused.log`, `outputs/backdrop-placeholder-retry.log`,
`outputs/backdrop-caption-retry.log` and `test-results/`. Earlier interrupted/failed
gate logs are retained separately, not presented as passing verification.

Do not describe forced-cycle checks as GPU/frame-pacing measurements. If the
user still sees periodic stutter after image-source churn is eliminated, capture
a frame/paint trace in the affected signed-in browser. Large transformed layers,
rotation and masks remain possible causes. Profile-specific override handoffs
and intentional account/privacy clearing can still replace the decorative set;
they must not be optimized by retaining revoked/private artwork. Physical Safari
testing remains deferred separately.

## Staging follow-up

The user still observes stutter after one to two minutes. At that point staging
was still running the earlier release: the stable-slot, shared-decoding and resize
fixes above had not been pushed or deployed. Treat this as a report about the old
build, not proof that the unshipped fixes failed.

A new isolated guest Chromium probe observes 150 real seconds, crossing two
70-second loop boundaries, with non-GET API requests blocked. It samples root,
image and scrolling-animation identity, source mutations, resource counts and
requestAnimationFrame cadence. This is **not** a GPU-presented-frame trace or a
reproduction of the user's signed-in physical browser. The first draft included
temporary image fade transitions in its animation identity comparison; the
corrected probe checks scrolling-lane animations only. Preserve the first report
as exploratory, not a scrolling-animation-reset finding.

The corrected **pre-release** observation retained all three scrolling animations,
the same background root and all image nodes through 150 seconds. Twenty source
changes occurred during initial loading/fallback, then the source/resource counts
were unchanged from 15 seconds onward, including both loop boundaries. It recorded
9,007 animation-frame callbacks, no callback gap above 50ms and a near-boundary
99th percentile of about 16.8ms. No page errors or non-GET API attempts occurred.
Do not interpret callback cadence as a guarantee of smooth GPU-presented frames.
Evidence: ignored `outputs/backdrop-cycles-before-corrected.json`; the earlier
unfiltered observation remains separate under `outputs/backdrop-cycles-before.json`.

The palette/browser checks preserve exact wallet totals, missing-price behavior,
red reset confirmation and the approved parent gradients. Release requires the
complete gate, an intended-files-only commit/push, regenerated staging config
preserving identity/save databases, secrets, flags and limiter namespaces, no cron,
then a fresh long observation and navigation/theme checks on the deployed URL.
No migration, ingestion, account writes or production release is required.

The approved palette/backdrop release passed the full local `npm run check`:
683 unit passes (one existing skip), build, lint/type check, and 168 Chromium
checks. The 21 existing complexity warnings are unchanged. Focused checks passed
the retained green/blue parent gradients, neutral wallet breakdowns, normal
statistics tones, exact valuations and all existing daily/gameplay behavior.
Dark desktop wallet and light phone statistics screenshots were inspected.

The final local 150-second observation also retained the same background root,
image nodes and all three scrolling animations. Forty-six initial empty-to-ready
source assignments finished within warm-up, then no source/resource change was
observed after the first 15-second sample. No page error or non-GET API attempt
occurred. Its dev-server resource count is not comparable to staging's bundled
request count, and callback timing while the test suite runs is not a GPU metric.
Evidence: ignored `outputs/auction-accent-staging-gate-final.log`,
`outputs/auction-accent-focused.log`, `outputs/backdrop-cycles-local-final.json`
and `test-results/`. Live deployment/verification results follow after release.
