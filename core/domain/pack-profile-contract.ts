import type { PackProfile, PullRateEvidence, ReplacementGroup } from "./pack-profile.ts";
import type { PullRateConfig } from "./types.ts";
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new TypeError("Invalid pack profile object");
  return v as Record<string, unknown>;
};
const text = (v: unknown): string => {
  if (typeof v !== "string") throw new TypeError("Invalid pack profile text");
  return v;
};
const positive = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new TypeError("Invalid pack slot count");
  return v;
};
const list = (v: unknown): string[] => {
  if (!Array.isArray(v)) throw new TypeError("Invalid pack profile list");
  return v.map(text);
};
const urls = (v: unknown): string[] => list(v).map(url => {
  if (new URL(url).protocol !== "https:") throw new TypeError("Invalid pack source URL");
  return url;
});
export function parseReplacements(value: unknown): Record<string, ReplacementGroup[]> {
  return Object.fromEntries(Object.entries(object(value)).map(([set, groups]) => {
    if (!Array.isArray(groups)) throw new TypeError("Invalid replacement groups");
    return [set, groups.map(value => {
      const g = object(value), upgrades = list(g.upgrades), base = text(g.base);
      if (!upgrades.length || new Set(upgrades).size !== upgrades.length || upgrades.includes(base)) throw new TypeError("Invalid replacement upgrades");
      return {base, count:positive(g.count), upgrades};
    })];
  }));
}
function parseProfile(value: unknown, id: string): PackProfile {
  const p = object(value);
  if (p.id !== id || !["en","ja"].includes(String(p.language)) || !Array.isArray(p.slots)) throw new TypeError("Invalid pack identity");
  const slots = p.slots.map(value => {
    const s = object(value);
    return {label:text(s.label), count:positive(s.count), tier:s.tier == null ? null : text(s.tier)};
  });
  const cardsPerPack = p.cardsPerPack == null ? null : positive(p.cardsPerPack);
  if (cardsPerPack != null && slots.reduce((sum,s)=>sum+s.count,0) !== cardsPerPack) throw new TypeError("Pack slots do not match printed size");
  return {id,game:text(p.game),language:p.language as "en"|"ja",cardsPerPack,slots,sources:urls(p.sources),notes:text(p.notes)};
}
function parseEvidence(value: unknown): PullRateEvidence {
  const e = object(value);
  if (e.basis !== "observed" && e.basis !== "publisher") throw new TypeError("Invalid odds evidence basis");
  const sources = urls(e.sources);
  if (!sources.length) throw new TypeError("Odds require a source");
  const reviewedAt = text(e.reviewedAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) throw new TypeError("Invalid odds review date");
  return {sources,basis:e.basis,sampleSizeMinimum:e.sampleSizeMinimum == null ? null : positive(e.sampleSizeMinimum),notes:text(e.notes),reviewedAt};
}
export function parsePackMetadata(source: Record<string, unknown>): Partial<PullRateConfig> {
  if (source.version == null) return {};
  if (source.version !== 2) throw new TypeError("Unsupported pack config version");
  const profiles = Object.fromEntries(Object.entries(object(source.profiles)).map(([id,p])=>[id,parseProfile(p,id)]));
  const ref = (v: unknown) => { const id=text(v); if(!profiles[id])throw new TypeError(`Unknown pack profile: ${id}`);return id; };
  const setProfiles = Object.fromEntries(Object.entries(object(source.setProfiles)).map(([game,sets])=>[game,Object.fromEntries(Object.entries(object(sets)).map(([set,id])=>{
    const key=ref(id);if(profiles[key].game!==game)throw new TypeError("Cross-game pack profile");return [set,key];
  }))]));
  const productProfiles = Object.fromEntries(Object.entries(object(source.productProfiles)).map(([id,p])=>[id,ref(p)]));
  const evidence = Object.fromEntries(Object.entries(object(source.evidence)).map(([key,e])=>[key,parseEvidence(e)]));
  return {version:2,profiles,setProfiles,productProfiles,evidence};
}
