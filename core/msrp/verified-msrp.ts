// Hand-curated, officially-sourced MSRPs keyed "<game>:<productId>" (audit Phase C,
// "verified + derived, badged"). Sources per row; the full provenance table lives in
// docs/msrp-sources.md. Values here outrank derived standard pricing but never overwrite
// an MSRP the product feed already carries. Products whose only price is secondary-sourced
// (flagged soft in the research) stay OUT of this table until a distributor publishes one.
export type VerifiedMsrpEntry = { msrp: number; source: string };
const verifiedMsrp: Record<string, VerifiedMsrpEntry> = {
  "riftbound:658333": { msrp: 99.99, source: "Riot merch (Worlds Bundle 2025)" },
  "riftbound:635458": { msrp: 79.96, source: "PHD Games sheet 2025-03 (4×$19.99 deck display)" },
  "riftbound:678690": { msrp: 480, source: "UVS Games Spiritforged retailer PDF" },
  "riftbound:678159": { msrp: 480, source: "PHD Games sheet 2025-12" },
  "riftbound:678162": { msrp: 34.99, source: "PHD Games sheet 2025-12" },
  "riftbound:697970": { msrp: 34.99, source: "PHD Games sheet 2026-03" },
  "riftbound:697971": { msrp: 34.99, source: "PHD Games sheet 2026-03 (display ÷ 4)" },
  "riftbound:706237": { msrp: 139.96, source: "PHD Games sheet 2026-03 (4-deck display)" },
  "riftbound:707963": { msrp: 480, source: "PHD Games sheet 2026-03" },
  "riftbound:710238": { msrp: 70, source: "Riot official (event-exclusive price)" },
  "riftbound:711365": { msrp: 120, source: "PHD Games sheet 2026-06 + Coqui Hobby" },
  "riftbound:711368": { msrp: 34.99, source: "PHD Games sheet 2026-06 (display ÷ 4)" },
  "riftbound:711369": { msrp: 139.96, source: "PHD Games sheet 2026-06 (4-deck display)" },
  "riftbound:711372": { msrp: 34.99, source: "PHD Games sheet 2026-06 + Coqui Hobby" },
  "riftbound:712806": { msrp: 120, source: "PHD Games sheet 2026-08" },
  "riftbound:712813": { msrp: 34.99, source: "PHD Games sheet 2026-08" },
  // One Piece: Bandai-published MSRPs migrated 2026-08-31 from the retired hand-curated
  // sealed-onepiece.json (its rows all carried "Published product MSRP") when the feed
  // became generated from the full category-68 walk.
  "onepiece:516299": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:593446": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:610116": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:610117": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:646591": { msrp: 20.99, source: "Bandai published MSRP" },
  "onepiece:646592": { msrp: 20.99, source: "Bandai published MSRP" },
  "onepiece:649748": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:669241": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:669242": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:669278": { msrp: 12.99, source: "Bandai published MSRP" },
  "onepiece:682789": { msrp: 12.99, source: "Bandai published MSRP" },
  "onepiece:689341": { msrp: 4.99, source: "Bandai published MSRP" },
  "onepiece:693364": { msrp: 12.99, source: "Bandai published MSRP" },
  "onepiece:694721": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:694722": { msrp: 24.99, source: "Bandai published MSRP" },
  "onepiece:694893": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:704757": { msrp: 15, source: "Bandai published MSRP" },
  "onepiece:704885": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:704889": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:704890": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:704893": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:704894": { msrp: 19.99, source: "Bandai published MSRP" },
  "onepiece:704897": { msrp: 19.99, source: "Bandai published MSRP" },
};
export default verifiedMsrp;
