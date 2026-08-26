# Scalper Mode variant review

Generated from `scalper.txt` against the current TCGCSV catalogs. No synthetic products are included. The recommendations below preserve every legitimate retail-art variant while excluding cases, displays, and multipacks unless the watchlist explicitly names one.

## Recommended: include every listed individual variant

- [ ] **Phantasmal Evolutions 3-Pack Blister** — include Sneasel (`654154`) and Weavile (`654156`).
- [ ] **Ascended Tech Stickers** — include Gastly (`666909`) and Charmander (`666908`).
- [ ] **Ascended Poster Collection** — include Mega Lucario (`668536`) and Mega Gardevoir (`668537`).
- [ ] **Ascended Heroes EX Box** — include Mega Emboar (`672734`), Mega Meganium (`672733`), and Mega Feraligatr (`672735`).
- [ ] **Mega Evolution 3 Pack Blister** — include Golduck (`644356`) and Psyduck (`644357`).
- [ ] **Mega Evolution Checklane Blister Pack** — include Tyranitar (`644360`) and Meowscarada (`644361`).
- [ ] **Destined Rival Single Blister** — include Eevee (`633105`) and Zarude (`633106`).
- [ ] **Destined Rival 3-Pack Blister** — include Zebstrika (`625684`) and Kangaskhan (`625683`). The separate Set of 2 product is not recommended because the watchlist names a single blister.
- [ ] **Unova Mini Tin** — include all eight individual tin artworks: Alomomola & Axew (`630444`), Chandelure & Zorua (`630439`), Volcarona & Emolga (`630441`), Garbodor & Amoonguss (`630438`), Mienshao & Klinklang (`630443`), Lilligant & Whimsicott (`630442`), Eelektross & Galvantula (`630445`), and Krookodile & Excadrill (`630440`).

## Confirmation required

### Mega Charizard Tin 1 / 2 / 3

TCGCSV currently has only two matching individual products:

- Mega Charizard Tin (Mega Charizard X) — `671250`
- Mega Charizard Tin (Mega Charizard Y) — `671249`

The watchlist has three numbered lines, but those numbers do not identify X/Y and TCGCSV has no third individual Mega Charizard Tin. Recommended resolution: include X and Y once each, deduplicate the repeated watchlist lines, and apply the supplied `$24.99` override to both. Confirm this or provide the intended mapping for Tin 1, 2, and 3.

### One Piece Tin Pack Set Vol. 2 (Random Art)

TCGCSV has three individual art listings and one combined set:

- Sabo — `669278`
- Portgas.D.Ace — `669277`
- Monkey.D.Luffy — `669273`
- Set of 3 — `669298`

Recommended resolution: include the three individual random-art listings at the supplied `$12.99` override and exclude the Set of 3, because `$12.99` describes a single random tin rather than all three. Confirm this or choose the Set of 3 instead.

## Reconciliation totals

- Source entries: 173
- Confident single matches: 118
- Entries awaiting variant confirmation: 13 (represented by the 11 decisions above)
- Unmatched: 42
- TCGCSV sealed candidates searched: 4,642 across Pokémon, One Piece, Yu-Gi-Oh!, Lorcana, and Riftbound

The machine-readable evidence, scores, alternative candidates, source lines, and product IDs are in `docs/scalper-reconciliation.json`.
