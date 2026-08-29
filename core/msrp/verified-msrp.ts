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
};
export default verifiedMsrp;
