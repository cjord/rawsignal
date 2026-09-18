# Riftbound catalog expansion — 2026-09-18

Status: local implementation, not pushed or deployed. Reproduce with
`npm run data:sync:singles -- --riftbound-only`. Pokémon feeds are unchanged.

## Inclusion decision

Include English singles across common/uncommon/rare/epic/showcase tiers, alternate-art
runes (including Nexus Night alternate art), distinct promo art, judge cards,
Top 8/Champion-stamped cards, and Metal/Best Of/Prize Wall printings. Keep separate
TCGplayer product identities and explicit missing prices. Ordinary foreign-language
duplicates, basic runes, tokens and regular-art promos are excluded by user decision.

The shared `riftboundExclusion` policy uses source card type, collector number,
named treatment and source group. Alternate rune numbers (a/b/c suffixes) distinguish
them from basic runes. Other promo art uses an explicit alternate-art name or a
variant collector-number suffix; judge/tournament and Secret Garden entries are
explicit exceptions. A new ambiguous promo must be reviewed, not silently presumed
to be alternate art. Existing preferred-printing behavior (one source product ID,
highest priced available printing) is unchanged.

## Measured coverage

The refresh reads 1,561 products from currently published TCGCSV category-89 groups.
1,332 eligible source cards plus one curated foreign-exclusive identity = **1,333**
cards, **616 more** than the immediately preceding 717-card Metal-inclusive feed.

| Exclusion | Cards |
| --- | ---: |
| Regular-art promos | 122 |
| Basic runes | 24 |
| Tokens | 23 |
| Ordinary foreign duplicates encountered in category 89 | 0 |
| Total policy-excluded cards | 169 |

Another 60 source products lack required card metadata (mostly sealed/accessory
records); these are not counted as excluded card identities. Counts are per source
product ID, not physical cards or finish variants. The manifest's `rejected` values
are the reproducible audit. Zero foreign duplicates means none in this source
population, **not** zero foreign printings worldwide. Future/unpublished groups are
outside the local refresh; the production live walk retains its existing presale horizon.

## Foreign-exclusive entry

Lunar Irelia: `Irelia, Blade Dancer (Lunar Revel 2026) (Chinese)`, number `195a/221`,
local ID `900000001`. [Riot's product listing](https://merch.riotgames.com/en-us/product/riftbound-lunar-revel-bundle-2026/)
confirms the Chinese-language Mythmaker Irelia promo;
[Beckett's card catalog](https://www.beckett.com/gaming/2026/riftbound-league-of-legends-tcg-promos-simplified-chinese/195a-irelia---blade-dancer-plunar-revel-bundle-26-33496263)
identifies the collector number. This is a curated local ID, not a TCGplayer product ID.
The shared history client refuses upstream requests for it, TCGplayer links search
rather than inventing a product page, and eBay queries carry Chinese language and
Lunar identity qualifiers. No market price, artwork or foil finish is guessed.

The curated registry is an allowlist, not a blanket foreign-catalog import. Additional
foreign-exclusive cards require verified identity/language and an explicit stable
entry. Ordinary foreign versions of T1, Worlds and Secret Garden are not auto-added.
This is not a claim that every foreign-exclusive promo worldwide has been cataloged.

[Riot's Unleashed overview](https://playriftbound.com/en-us/news/announcements/the-unleashed-overview/)
confirms Nexus Night alternate-art runes carry over from Spiritforged; those remain
included despite excluding regular-art Nexus Night promos.

## Operational boundaries

No new cron, paid source, eBay budget increase, or database migration. Source cards
reuse the existing group downloads; the curated entry is a final checkpointed group.
Additional retained cards still incur ordinary catalog writes and, when priced,
tiered history work. eBay remains demand-driven with the existing shared quota.
Missing prices never become zero observations or signals. The new catalog section
names do not rename the existing pack-EV aggregate tiers.
