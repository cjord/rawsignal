// Maintained research inputs. Regenerate public/data/pull-rates.json with build.mjs.
// Unknown probabilities are absent. No price or catalog-count based inference.
export const reviewedAt = "2026-09-17";
export const sources = {
  modern: "https://support.pokemon.com/hc/en-us/articles/360000981613-What-can-I-expect-in-a-Pok%C3%A9mon-Trading-Card-Game-booster-pack",
  history: "https://bulbapedia.bulbagarden.net/wiki/Pull_ratio",
  jp: "https://www.pokemon-card.com/ex/sv1/",
  origins: "https://playriftbound.com/en-us/news/announcements/collectability-in-riftbound-origins/",
};
const article = (slug, id) => `https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-${slug}-Pull-Rates/${id}/`;
// Rates are observed percentages unless explicitly entered as packs per hit below.
// Keep each set's own sample; never extrapolate these to a new set or language.
const modern = [
  ["SV01: Scarlet & Violet Base Set", "Scarlet-Violet", "a7702fce-dd64-4a58-beb1-0f871c853215", 8000, [13.76,6.57,7.67,3.15,1.85]],
  ["SV02: Paldea Evolved", "Paldea-Evolved", "1b7d3e70-9542-4a50-8692-1661e2316521", 8000, [13.72,6.64,7.70,3.17,1.76]],
  ["SV03: Obsidian Flames", "Obsidian-Flames", "e2a66999-a7b5-4621-9765-c9a132e04bd2", 8000, [13.61,6.63,7.60,3.13,1.92]],
  ["SV: Scarlet & Violet 151", "Scarlet-Violet%E2%80%94151", "b237df74-fbb0-40d0-9e13-d69ee6e804d9", 1500, [13.28,6.44,8.50,3.11,1.94]],
  ["SV04: Paradox Rift", "Paradox-Rift", "0b5fb648-38fc-4f61-a6af-57c2737b4a48", 8000, [15.57,6.64,7.70,2.11,1.22]],
  ["SV05: Temporal Forces", "Temporal-Forces", "28c0ad22-00a4-428f-b22d-e7fee9ec50bc", 8000, [16.83,6.67,7.72,1.17,.72], 5],
  ["SV06: Twilight Masquerade", "Twilight-Masquerade", "f3eea967-e5fb-4108-8655-bb1c89587628", 8000, [16.93,6.61,7.73,1.17,.68], 5.06],
  ["SV07: Stellar Crown", "Stellar-Crown", "2c0743dd-dbd0-4504-9ff8-be5a72dd04d1", 8000, [16.90,6.75,7.79,1.11,.73], 4.94],
  ["SV08: Surging Sparks", "Surging-Sparks", "6ccfb6ab-f26a-4ce8-bab5-5f91c85ec70e", 8000, [16.94,6.74,7.67,1.15,.53], 5.03],
  ["SV10: Destined Rivals", "Destined-Rivals", "43ba832e-44c9-45a4-ae2e-594df2defdda", 8000, [19.83,6.39,8.29,1.06,.67]],
  ["ME01: Mega Evolution", "Mega-Evolution", "40cbeedc-21ce-473b-aef1-74e3969d9f91", 5000, [20.91,8.23,10.89,.99,.08]],
  ["ME02: Phantasmal Flames", "Phantasmal-Flames", "9abae60d-b7fb-448f-874e-176f78d6a6ca", 5000, [20.77,8.06,10.97,1.25,.08]],
  ["ME03: Perfect Order", "Perfect-Order", "73148119-ebcb-40b7-84b6-52b3a6d0c631", 3500, [20.97,8.54,11.20,1.23,.06]],
  ["ME04: Chaos Rising", "Chaos-Rising", "304e8bfc-175a-4d31-93fe-5bb1be11e5d2", 8500, [20.30,8.29,10.66,1.21,.10]],
];
const tiers = ["Double Rare","Ultra Rare","Illustration Rare","Special Illustration Rare","Hyper Rare"];
const fromPercent = rates => Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, 100 / value]));
export const observations = modern.map(([set,slug,id,sampleSizeMinimum,percentages,ace]) => ({
  game:"pokemon", set, sources:[article(slug,id)], sampleSizeMinimum,
  basis:"observed", notes:"Sample estimates; equal frequency within a rarity is an assumption. Printed percentage precision is retained. Foil patterns and Energy are excluded from valuation.",
  rates:fromPercent(Object.fromEntries([...percentages.map((p,i)=>[set.startsWith("ME")&&i===4?"Mega Hyper Rare":tiers[i],p]), ...(ace?[["ACE SPEC Rare",ace]]:[])])),
}));
const add = (set, slug, id, sampleSizeMinimum, rates, notes = "") => observations.push({game:"pokemon",set,sources:[article(slug,id)],sampleSizeMinimum,basis:"observed",rates,notes});
add("SV09: Journey Together","Journey-Together","1b9f379f-97cb-45cc-b6f6-a1a070a422cd",8000,
  {"Double Rare":5,"Ultra Rare":15,"Illustration Rare":12,"Special Illustration Rare":86,"Hyper Rare":137},"Rounded source denominators; equal frequency within a rarity assumed.");
add("SV: Paldean Fates","Paldean-Fates","23de3e93-0d0f-4ae0-abc4-13664f3001a3",1500,
  fromPercent({"Double Rare":15.89,"Ultra Rare":6.61,"Shiny Rare":25.44,"Shiny Ultra Rare":7.72,"Illustration Rare":7.22,"Special Illustration Rare":1.72,"Hyper Rare":1.61}));
add("SV: Prismatic Evolutions","Prismatic-Evolutions","d94889ea-f76a-4a13-b74d-5b0b071220a7",1200,
  fromPercent({"Double Rare":16.51,"Ultra Rare":7.46,"ACE SPEC Rare":4.68,"Special Illustration Rare":2.22,"Hyper Rare":.56}),
  "SIR is average card yield: multi-hit god/demigod packs mean this is not the probability of a pack containing a hit. Poké Ball (33.10%) and Master Ball (4.92%) are excluded until printing-specific prices are available. This set has no Illustration Rare tier.");
for (const set of ["SV: Black Bolt","SV: White Flare"]) add(set,"Black-Bolt-and-White-Flare","bac92199-a2a7-4668-b4a4-2647a111776f",700,
  fromPercent({"Double Rare":21.11,"Ultra Rare":5.83,"Illustration Rare":16.39,"Special Illustration Rare":1.25}),
  "Small combined sample across both English sets, not 700 packs per set. Black White Rare was not observed: odds unavailable, not zero. Poké Ball/Master Ball patterns excluded from valuation.");
observations.push({game:"pokemon",set:"ME: Ascended Heroes",sources:["https://www.pokebeach.com/2026/02/ascended-heroes-pull-rates-finally-determined-better-than-usual"],sampleSizeMinimum:2000,basis:"observed",rates:{"Double Rare":5,"Illustration Rare":9,"Ultra Rare":21,"Special Illustration Rare":70,"Mega Hyper Rare":540,"Mega Attack Rare":29},notes:"Secondary report of TCGplayer's sample; rounded denominators."});
// SWSH aggregate categories overlap catalog rarity strings (V, VMAX, full arts and
// galleries). Only unambiguous, disjoint rarity matches are enabled at this stage.
for(const [set,slug,id,radiant] of [
  ["SWSH11: Lost Origin","Lost-Origin","ba20ac4d-9448-45ce-b919-d856d107c744",5.01],
  ["SWSH12: Silver Tempest","Silver-Tempest","6490d591-e582-4930-8446-00e190876d30",4.55],
  ["SWSH: Crown Zenith","Crown-Zenith","56af3032-cb34-4da1-92fb-9cf206d10c0f",4.55],
]) add(set,slug,id,set.includes("Zenith")?1900:8000,{"Radiant Rare":100/radiant},"Partial: V/VMAX/full-art and gallery aggregates require a separate collector-number taxonomy; their overlapping source categories are not applied to the catalog's Ultra Rare tier.");
observations.push({game:"riftbound",set:"Origins",sources:[sources.origins],sampleSizeMinimum:null,basis:"publisher",rates:{Epic:4,"alt-arts":12,overnumbered:80,signatures:720},notes:"Epic is an approximate pack incidence (two Epics are possible); its inverse is only an approximate yield. Overnumber includes Signature: non-signature yield = (1/72) × 0.9 = 1/80. Ordinary rare, foil and rune yields remain unknown; no two-Rare baseline is added."});

// Exact assignments: new catalog sets require review rather than a guessed era default.
export const englishGroups = {
  wotc:"Base Set|Base Set (Shadowless)|Base Set 2|Fossil|Gym Challenge|Gym Heroes|Jungle|Neo Destiny|Neo Discovery|Neo Genesis|Neo Revelation|Team Rocket",
  ex:"Aquapolis|Expedition|Skyridge|EX Crystal Guardians|EX Delta Species|EX Deoxys|EX Dragon|EX Dragon Frontiers|EX Emerald|EX FireRed & LeafGreen|EX Hidden Legends|EX Holon Phantoms|EX Legend Maker|EX Power Keepers|EX Ruby and Sapphire|EX Sandstorm|EX Team Magma vs Team Aqua|EX Team Rocket Returns|EX Unseen Forces",
  ten:"Arceus|Call of Legends|Diamond and Pearl|Great Encounters|HeartGold SoulSilver|Legends Awakened|Majestic Dawn|Mysterious Treasures|Platinum|Rising Rivals|Secret Wonders|Stormfront|Supreme Victors|Triumphant|Undaunted|Unleashed|Black and White|Boundaries Crossed|Dark Explorers|Dragons Exalted|Emerging Powers|Next Destinies|Noble Victories|Plasma Blast|Plasma Freeze|Plasma Storm|XY Base Set|XY - Flashfire|XY - Furious Fists|XY - Phantom Forces|XY - Primal Clash|XY - Roaring Skies|XY - Ancient Origins|XY - BREAKthrough|XY - BREAKpoint|XY - Fates Collide|XY - Steam Siege|XY - Evolutions|SM Base Set|SM - Guardians Rising|SM - Burning Shadows|SM - Crimson Invasion|SM - Ultra Prism|SM - Forbidden Light|SM - Celestial Storm|SM - Lost Thunder|SM - Team Up|SM - Unbroken Bonds|SM - Unified Minds|SM - Cosmic Eclipse|SWSH01: Sword & Shield Base Set|SWSH02: Rebel Clash|SWSH03: Darkness Ablaze|SWSH04: Vivid Voltage|SWSH05: Battle Styles|SWSH06: Chilling Reign|SWSH07: Evolving Skies|SWSH08: Fusion Strike|SWSH09: Brilliant Stars|SWSH10: Astral Radiance|SWSH11: Lost Origin|SWSH12: Silver Tempest",
  modern:"SV01: Scarlet & Violet Base Set|SV02: Paldea Evolved|SV03: Obsidian Flames|SV04: Paradox Rift|SV05: Temporal Forces|SV06: Twilight Masquerade|SV07: Stellar Crown|SV08: Surging Sparks|SV09: Journey Together|SV10: Destined Rivals|ME01: Mega Evolution|ME02: Phantasmal Flames|ME03: Perfect Order|ME04: Chaos Rising|ME05: Pitch Black|ME06: Delta Reign|SV: Scarlet & Violet 151|SV: Paldean Fates|SV: Shrouded Fable|SV: Prismatic Evolutions|SV: Black Bolt|SV: White Flare|ME: Ascended Heroes",
  special10:"Legendary Treasures|Generations|Shining Legends|Dragon Majesty|Hidden Fates|Champion's Path|Shining Fates|Pokemon GO|SWSH: Crown Zenith",
};
export const japaneseCodes = "M2|M2a|M3|M4|M5|M6|S1a|S2|S2a|S3|S3a|S4|S4a|S5I|S5R|S5a|S6H|S6K|S6a|S7D|S7R|S8|S8a|S8b|S9|S9a|S10D|S10P|S10a|S10b|S11|S11a|S12|S12a|SV1S|SV1V|SV1a|SV2D|SV2P|SV2a|SV3|SV3a|SV4K|SV4M|SV4a|SV5K|SV5M|SV5a|SV6|SV6a|SV7|SV7a|SV8|SV8a|SV9|SV9a|SV10|SV11B|SV11W|m1L|m1S".split("|");
export const japaneseExceptions = {
  S3a:[7,"https://www.pokemon-card.com/products/s/s3a.html"],
  S9a:[6,"https://www.pokemon-card.com/products/s/s9a.html"], S10a:[6,"https://www.pokemon-card.com/products/s/s10a.html"],
  S10b:[6,"https://www.pokemon-card.com/ex/s10b/index.html"], S11a:[6,"https://www.pokemon-card.com/products/s/s11a.html"],
  S4a:[10,"https://www.pokemon-card.com/ex/s4a/index.html"], S12a:[10,"https://www.pokemon-card.com/ex/s12a/index.html"],
  SV4a:[10,"https://www.pokemon-card.com/ex/sv4a/index.html"], SV8a:[10,"https://www.pokemon-card.com/ex/sv8a/index.html"],
  M2a:[10,"https://www.pokemon-card.com/ex/m2a/"], S8b:[11,"https://www.pokemon-card.com/ex/s8b/index.html"],
  S8a:[5,"https://www.pokemon-card.com/ex/25th/products/"], SV2a:[7,"https://www.pokemon-card.com/ex/sv2a/index.html"],
  SV11B:[7,"https://www.pokemon-card.com/ex/sv11/"], SV11W:[7,"https://www.pokemon-card.com/ex/sv11/"],
};
