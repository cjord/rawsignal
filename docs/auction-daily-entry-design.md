# Daily Challenge Entry and Auction Surface Polish

## Feature names and review

- **Daily Challenge Entry:** one shared illustration on the lobby link and start button; purple border distinguishes it from the two normal auction tiers. Images have reserved 3:2 dimensions, with real accessible text outside the artwork.
- **Daily Challenge Briefing:** replaces two dense paragraphs with a short introduction, three fact tiles (bankroll, sequence, reward), and readable rules. Midnight expiry, running timers and early-exit consequences remain visible, not hidden in a tooltip. Browser-limit details live in an informational tooltip. The redundant Normal Auctions backlink is removed; Auction Hub navigation remains.
- **Inventory Overview:** plain site-native surfaces and borders, blue values and green cash instead of repeated purple fills.
- **Rarity Quick Sales:** text uses the same rarity palette as collection cards; names, disabled states and confirmation flow remain intact. Sell All stays neutral.
- **Sharing & Visibility Panel:** one neutral outer surface, transparent nested content, clipped corner edges; no separate purple inner rectangle.
- **Bilgewater Entry:** Free Entry is green in the heading. The subtitle reads “25–90 cards - Premium Cards.” This is descriptive copy, not a guarantee of collection value or a change to generation odds.

No changes to auction generation, reward rules, account storage, market data or production deployment are required.

## Generated asset

- Built-in image generation; use case: product-mockup.
- Final asset: `public/images/games/auction-entry-daily.webp`, 960 × 640, opaque WebP.
- Generated at 1536 × 1024; mechanically resized and encoded with Sharp, without cropping. No runtime image dependency was added.
- Visual review: five distinct navy-and-gold card lots, violet accents and a brass hourglass, matching the existing entry art. No text or user-interface elements baked in.

### Final generation prompt

Create a premium fantasy trading-card auction illustration, landscape 3:2 composition. A Daily Five-Auction Challenge: five elegant face-down card bundles laid out in a shallow arc on a dark slate and midnight-blue tabletop, each bundle distinct but cohesive, progressing from simple navy leather sleeves to a luxurious small open gilded collection chest. A small ornate brass hourglass anchors the center, suggesting a daily timed challenge. Restrained violet and cool blue light, warm gold highlights, navy leather, fine brass filigree and subtle four-point arcane star motifs on card backs. High-end painterly product illustration with convincing rich materials, atmospheric and polished, readable at thumbnail size. Match a dark trading-card market dashboard aesthetic, calm rather than cartoonish. Keep all important subjects within the frame, no cropping of card bundles. No text, numbers, letters, logos, people, money, casino chips, UI elements or decorative border. Opaque dark background.

## Verification scope

Browser coverage checks entry artwork, purple/green accents, no attempt consumed by navigation, start-button artwork, visible deadline rules, neutral inventory surfaces, rarity sales text and uniform sharing surfaces. Screenshots cover desktop/mobile and dark/light themes. Existing daily-run tests cover start, resume, completion, reward, expiry and failed-manifest behavior.

Release gate: `npm run check` passed with 683 unit tests, one existing skip and all 168 Chromium checks. Lint retained its 21 existing complexity warnings, with no new warnings. The entry-art test now expects three illustrated options; the wallet layout test waits for the actual wallet instead of racing its replacing skeleton, preserving the same sub-pixel stability assertion.
