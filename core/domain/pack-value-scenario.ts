import type {ValueBreakdown,ValueBreakdownTier} from "./types.ts";

// Standard English booster displays only. Special sets, regional half displays,
// collections and unreviewed formats must not silently inherit a 36-pack box.
// Sources and scope: docs/pack-profiles-2026-09.md, Calculator controls.
const pokemonBoxes=new Set([
 "SV01: Scarlet & Violet Base Set","SV02: Paldea Evolved","SV03: Obsidian Flames",
 "SV04: Paradox Rift","SV05: Temporal Forces","SV06: Twilight Masquerade",
 "SV07: Stellar Crown","SV08: Surging Sparks","SV09: Journey Together","SV10: Destined Rivals",
 "ME01: Mega Evolution","ME02: Phantasmal Flames","ME03: Perfect Order","ME04: Chaos Rising",
 "SWSH11: Lost Origin","SWSH12: Silver Tempest",
]);
const riftboundBoxes=new Set(["Origins","Spiritforged","Unleashed","Vendetta"]);
export function standardBoxPacks(game:string,set:string,language:string):number|null{
 if(language!=="en")return null;
 if(game==="pokemon"&&pokemonBoxes.has(set))return 36;
 if(game==="riftbound"&&riftboundBoxes.has(set))return 24;
 return null;
}

export type RarityExclusion={key:string;label:string};
export function rarityExclusions(game:string,tiers:ValueBreakdownTier[]):RarityExclusion[]{
 const keys=new Set(tiers.map(tier=>tier.key));
 const highest=(order:string[])=>order.find(key=>keys.has(key));
 const options:RarityExclusion[]=[];
 if(game==="pokemon"){
  if(keys.has("Special Illustration Rare"))options.push({key:"Special Illustration Rare",label:"Exclude SIRs"});
  const top=highest(["Mega Hyper Rare","Black White Rare","Hyper Rare","Rainbow Rare","Secret Rare","Shiny Ultra Rare","Ultra Rare","Radiant Rare"]);
  // Do not offer a lower-tier fallback as "highest" when SIR is already present.
  if(top&&(!keys.has("Special Illustration Rare")||["Mega Hyper Rare","Black White Rare","Hyper Rare"].includes(top)))options.push({key:top,label:`Exclude ${top}s`});
 }
 if(game==="riftbound"){
  if(keys.has("signatures"))options.push({key:"signatures",label:"Exclude Signatures"});
  const top=highest(["Ultimate","ultimate","overnumbered","alt-arts","epics"]);
  if(top&&(!keys.has("signatures")||/ultimate/i.test(top)))options.push({key:top,label:`Exclude ${tiers.find(t=>t.key===top)!.label}`});
 }
 return options;
}

// Exclusion removes a contribution; it never redistributes its odds to other tiers.
// Linear expectation scales to a box without assuming independent/guaranteed hits.
export function packValueScenario(breakdown:ValueBreakdown,excluded:readonly string[],packs:number){
 const multiplier=Number.isInteger(packs)&&packs>0?packs:null;
 const included=breakdown.tiers.filter(t=>!excluded.includes(t.key)&&t.evPerPack!=null);
 const perPack=included.length?included.reduce((sum,t)=>sum+t.evPerPack!,0):null;
 const total=perPack==null||multiplier==null?null:perPack*multiplier;
 const chase=included.filter(t=>t.chase).reduce((sum,t)=>sum+t.evPerPack!,0);
 return {total,chaseShare:perPack!=null&&perPack>0?chase/perPack:null,tiers:breakdown.tiers.map(tier=>{
  const isExcluded=excluded.includes(tier.key);
  return {...tier,excluded:isExcluded,value:isExcluded||tier.evPerPack==null||multiplier==null?null:tier.evPerPack*multiplier,
   share:!isExcluded&&tier.evPerPack!=null&&perPack!=null&&perPack>0?tier.evPerPack/perPack:null};
 })};
}
