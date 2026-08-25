# Legacy research artifacts

Two root files are retained as an auditable snapshot of the original product exploration:

- `research.mjs` scraped selected PriceCharting pages and attempted to infer a 30-day TCGplayer volume label from visible dated rows.
- `cards.json` is the generated snapshot from that experiment.

They are deliberately not part of the maintained application.

## Restrictions

- Do not run `research.mjs` as a production refresh.
- Do not import `cards.json` into catalog or signal code.
- Do not describe its visible-row count as complete transaction volume.
- Do not update these files when refreshing TCGCSV feeds.
- Do not delete them until their archival value has been reviewed separately.

Production Singles data comes from `sync-tcgcsv.mjs`; current Pokémon Sealed generation comes from `sync-sealed.mjs`. Dated price history is normalized through `/api/history` and the durable backfill boundary.
