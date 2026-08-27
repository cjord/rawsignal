// Accumulates one set/rarity peer-average observation per TCGCSV publish date and rebuilds
// the bundled fair-value anchor summary. Run after sync-tcgcsv.mjs; reruns on the same
// publish date replace that date's rows, so the cadence follows TCGCSV updates exactly.
//   data-history/peer-averages.json  committed accumulator (not bundled)
//   public/data/peer-context.json    compact per-cohort summary consumed by the app
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishValidatedFiles } from "../io/last-good.mjs";
import { appendPeerHistory, dailyPeerAverages, summarizePeerHistory } from "./peer-history.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = async relative => JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));

const index = await readJson("tcg-index.json");
const sourceUpdatedAt = typeof index.sourceUpdatedAt === "string" ? index.sourceUpdatedAt : null;
if (!sourceUpdatedAt) throw new Error("tcg-index.json has no sourceUpdatedAt; run sync-tcgcsv.mjs first.");
const date = sourceUpdatedAt.slice(0, 10);

const cards = [];
for (const sections of Object.values(index.rarities ?? {})) {
  for (const { key } of sections) {
    if (key === "all") continue;
    cards.push(...await readJson(`public/data/${key}.json`));
  }
}
if (cards.length < 1000) throw new Error(`Refusing to accumulate from only ${cards.length} cards.`);

const previous = await readJson("data-history/peer-averages.json").catch(() => ({}));
const history = appendPeerHistory(previous, date, dailyPeerAverages(cards));
const entries = summarizePeerHistory(history);
await publishValidatedFiles({
  [path.join(root, "data-history", "peer-averages.json")]: history,
  [path.join(root, "public", "data", "peer-context.json")]: {
    schema: 1,
    source: "TCGCSV / TCGplayer set-rarity averages",
    sourceUpdatedAt,
    generatedAt: new Date().toISOString(),
    entries,
  },
});
const observationCounts = Object.values(entries).map(entry => entry.observations);
console.log({
  date,
  cohorts: observationCounts.length,
  maxObservations: observationCounts.length ? Math.max(...observationCounts) : 0,
});
