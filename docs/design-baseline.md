# Design baseline

The aesthetic source of truth for Raw Signal (docs/todo.md item A2, established 2026-08-27
alongside the Phase 1 UI cleanup). New UI must conform to this file or change it
deliberately in the same commit. When a rule here conflicts with older CSS still in the
tree, this file wins and the CSS is the bug.

## Tokens

Defined in `app/styles/tokens.css` (dimensions/motion/stacking) and `app/globals.css`
(colors/surfaces). Use tokens, never re-derive values inline.

- **Accents**: `--blue` #2e6cff (primary/interactive), `--purple` #7557ff (Riftbound accent).
- **Movement colors**: up/positive `#29b878` (legacy text tone `#16845b`), down/negative
  `#e05454` (legacy `#d24242`). Buy green `#16875f`, sell red `#c64747` (signal tabs).
  New work uses `#29b878`/`#e05454` and the buy/sell pair; don't introduce new greens/reds.
- **Neutrals & surfaces**: `--black` (text-strong), `--gray` (text-muted), `--line`
  (borders), `--soft` (inset fills), `--bg`, `--surface`, `--surface-raised`, `--control`,
  `--control-hover`, `--shadow`. Both themes redefine these — never hardcode a hex for a
  surface or border.
- **Geometry**: `--control-height` 56px, `--control-radius` 12px, `--panel-radius` 12px.
  Tiles/cards use radius 11–14px; pills 999px.
- **Motion**: `--motion-fast` 160ms, `--motion-standard` 180ms, `--ease-standard`
  cubic-bezier(.2,.75,.25,1). Every transition/animation must be disabled under
  `prefers-reduced-motion: reduce`.
- **Stacking**: `--z-sticky` 10, `--z-menu` 30, `--z-popover` 50. Don't invent z-indexes.
- **Focus**: 3px `color-mix(in srgb, var(--blue) ~56–64%, transparent)` outline with 1–3px
  offset (`--focus-ring` for box-shadow form). Every interactive element gets a visible
  `:focus-visible` state.

## Typography

- Families: `--font-sans` (Geist) for prose/labels, `--font-mono` (Geist Mono) for all
  numerals that get compared or scanned (prices, percentages, ranks, dates in stats).
- Casing: UPPERCASE + letter-spacing (.07–.12em) + `--gray` is the kicker/label voice.
  Headings and body are sentence case; proper nouns (game, set, product names) are
  Title Case via `formatGameName`/feed data — never raw keys like "riftbound" in copy.
- Current state: sizes are hardcoded px with an 8–13px annotation range, and the
  `data-font-size="large"` setting is a whitelist of overrides in globals.css.
  **Planned replacement (todo A1, decided):** a rem token ramp scaled from the root with a
  ~10.5px floor at Default, two steps (Default/Large). Until A1 lands: do not add any new
  font-size below 9.5px, and prefer an existing nearby size over a new value.

## Component anatomy

- **Section card** (`.detail-section`, KPI blocks): `--surface` background, 1px `--line`
  border, 18px radius, 20–27px padding. Header = kicker span (full-width) + h2
  (~25px, tight tracking) + optional right-aligned control (`margin-left:auto`).
- **Metric tile** (`.detail-metric`, `.history-stats > span`, `.full-prices > span`):
  `--control`/`--soft` fill, 1px border, 8–11px radius, uppercase micro-label + mono value
  (+ optional muted hint). Tone classes `.up`/`.down` color the value only.
- **Chip/pill**: 999px radius, 1px border, `--control` fill; active/positive states tint via
  `color-mix` with the accent at 10–15% — tint the fill, don't swap to solid color blocks.
- **Data table** (`.detail-variants-table`): right-aligned mono cells, uppercase micro
  headers on `--control`, row borders `--line`, active row tinted with blue at ~9%.
- **Popover / hover card**: `--surface-raised`, 1px border, 12–14px radius, strong shadow,
  top border may carry a 3px blue accent. Positioning comes from `useDisclosurePopover`
  (`data-popup-place`, `data-expand`) — never hand-roll popover placement.
- **Collapsible section** (`.detail-collapsible`): native `<details>`; summary reuses the
  section header anatomy plus a rotating `▸` mark; content stays in the DOM.
- **Info hint** (`.info-hint`): 15px ⓘ toggletip for *explanatory* copy — hover/focus
  reveal, tap to toggle, Escape closes; the text stays in the DOM so `aria-describedby`
  keeps announcing it. Explanations ride the ⓘ; *data* (dates, counts, delivered ranges)
  stays visible on the tile. Alignment flips near viewport edges via `data-align`.
- **Skeleton** (`.detail-skeleton`): shimmer placeholder matching the final component's
  footprint (metric tile, signal card, gauge lines) while client-fetched data resolves;
  static under reduced motion; wrappers are `aria-hidden` with `aria-busy` on the section.
  Route-level `loading.tsx` stays banned (vinext) — skeletons are always in-page.
- **Settings menu** (`.settings-menu`): 230–260px panel, section titles via
  `.settings-section-title`, controls full-width. Device preferences (theme, font size,
  signal strictness, scalper mode) live here — persisted in `localStorage` with
  `raw-signal-*` keys, never in the URL.

## Interaction rules

- **Hover is flat** (decided 2026-08-27, todo D1): background tint (`--control-hover` or
  `#fff`/`--surface-raised` on rows) + border-color shift + optional soft shadow. **No
  translateY lifts, no scale zooms** on tiles, rows, cards, buttons, or images.
  `--hover-lift` and `--popover-lift` are pinned to 0 and stay that way.
- Press feedback (`:active`) may compress ≤1% scale; selected-state emphasis (e.g. the
  view-toggle's active icon) is allowed — the ban is on *hover* movement.
- Sliding indicators (view toggle, signal tabs, price basis) animate `transform` with
  `--ease-standard`-family curves and must no-op under reduced motion.
- Charts: crosshair + cursor tooltip on pointer move; markers are HTML dots positioned by
  percentage (the SVG is stretched with `preserveAspectRatio="none"`, so viewBox circles
  render as ellipses — never draw fixed-radius shapes inside it).
- Disclosure popovers open on hover/focus via `useDisclosurePopover`; Escape closes;
  touch uses the in-flow expanded layout, never hover-dependent UI.

## Display type

- The masthead headline is the single display-type flourish: centered, 600 weight, with the
  closing phrase in a blue→purple gradient (`--blue` → `--purple`, the two game accents),
  guarded by `@supports (background-clip: text)` with a flat blue fallback. Gradient text
  appears nowhere else.

## Voice for data honesty

- Unavailable data renders "N/A"/"—", never a silent estimate.
- Models and signals are always labeled informational; one consolidated disclaimer per
  section, not per-tile fine print.
- Provenance (source + updated date) appears once per page, muted.

## Theming

- Dark is the default (`data-theme="dark"` pre-hydration via the head script); both themes
  ship complete token sets. Any new color must be specified for both or derived via
  `color-mix` from tokens.
- The method/footer band is intentionally near-black in both themes.
