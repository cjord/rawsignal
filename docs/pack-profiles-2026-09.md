# Set-specific pack profiles — 2026-09-17

Implemented locally; not deployed. Supersedes the era-wide pull-rate and additive
rare-slot assumptions in `set-value-breakdown-plan-2026-09.md`.

## Coverage and maintenance

`scripts/packs/research.mjs` holds the reviewed set assignments, measured rates,
source URLs, sample-size lower bounds, and caveats. `npm run data:build:packs`
generates `public/data/pull-rates.json` deterministically, without external requests.
Do not edit that generated asset. The generator rejects an unreviewed booster set.
The current inventory is 194 Pokémon sets (133 English, 61 Japanese) and four
Riftbound sets. There are 24 enabled odds overlays, some deliberately partial.

Profiles distinguish physical card count, slot labels, language and product overrides.
Black Bolt/White Flare Japanese deluxe products resolve to 35 cards while their regular
packs resolve to seven. Unknown products and new sets have no fallback odds. Mixed
miscellaneous products have an explicit unknown-composition profile.

Rates retain the reported percentage precision, converted to packs-per-card-yield;
where the research supplied only rounded denominators those are retained and labeled.
The review date is not the sample collection date. Sample sizes are reported approximate
minimums, not invented exact opening counts. Black Bolt/White Flare share a combined
700-pack study. The secondary Ascended Heroes report is identified as such.

## Calculation corrections

- No Pokémon-wide or Riftbound-wide probability defaults. Set name and game must
  match exactly; Japanese packs never inherit English rates.
- No Prismatic Illustration Rare rate: the set has no such tier. Its SIR figure is
  yield, not pack-hit probability, because of multi-hit packs.
- Origins non-signature Overnumbers use `(1/72) * 0.9 = 1/80`; signatures use 1/720.
  They partition the parent Overnumber rate instead of counting signatures twice.
- Origins Epic 1/4 is explicitly approximate incidence; multiple Epics are possible.
  Its use as yield is an approximation, not an exact distribution. Two base rares
  are not added on top: their residual distribution is unvalued, as are foil/rune slots.
- SV Base's verified Rare slot subtracts Double Rare and Ultra Rare rates. IR/SIR/HR
  upgrade the second reverse slot, not that Rare slot. Other uncertain remainders stay
  unavailable. Replacements use the full probability table even if upgrade prices are missing.
- Ordinary pack aggregates select Normal or standard Holofoil/Foil printing as
  appropriate, never the highest-priced reverse/parallel. Missing ordinary prices do
  not fall back to premium printings. A tier with any missing prices has no average/EV.
- Every breakdown is a partial subtotal; expected valued-card count is distinct from
  physical pack size. The EV/price ratio is informational, not an opening recommendation.

## Database and rollout

The existing per-group ingestion writes new aggregate keys prefixed `pack-v2:`;
readers strip that prefix and reject the old highest-printing aggregates. No migration,
extra upstream request, credential, or new scheduled job is needed. After deployment,
the next normal production catalog pass populates corrected rows. Staging has no cron,
so its breakdown remains unavailable until an explicitly requested ingestion test.
Old rows remain for rollback and are not deleted.

Set and sealed detail pages share `PackProfilePanel`. Feed-only sealed pages still show
composition and sourced odds, but lack full bulk aggregates and explicitly say so.
The set and sealed breakdowns read one set's corrected aggregate rows. Existing chase
EV surfaces still use tracked premium catalog cards; they are labeled partial and
should not be interpreted as the full bulk-inclusive subtotal.

## Remaining research limitations

No exact rarity odds are invented for vintage, Japanese, Spiritforged, Unleashed,
Vendetta, Shrouded Fable, Pitch Black or Delta Reign. A publisher upper bound (Unleashed
Ultimate <0.1%) and Spiritforged box-average lower bounds are recorded as notes, not
converted into point estimates.

Older SWSH source aggregates mix V/VMAX/full-art categories, gallery printings and the
catalog's broad Ultra Rare strings. Only unambiguous Radiant Rare mappings are enabled
for Lost Origin, Silver Tempest and Crown Zenith. Evolving Skies and Astral Radiance
need a collector-number/printing taxonomy before their full research tables can enter EV:

- https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Evolving-Skies-Pull-Rates/6a743d7b-e5ee-4fd6-9d18-64a636990e8c/
- https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Astral-Radiance-Pull-Rates/10da749f-9c8b-45c0-b80a-dbd86ca5dcde/

Poké Ball, Master Ball and other parallel-printing odds await matching printing-specific
price aggregates. Full Japanese singles ingestion, net resale proceeds, pack counts per
mixed collection, an MSRP slider and user-entered odds remain separate work.
