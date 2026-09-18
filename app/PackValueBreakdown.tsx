"use client";
import {useId,useState} from "react";
import type {ValueBreakdown,ValueBreakdownTier} from "../core/domain/types";
import {formatUsd} from "../core/domain/formatters";
import {packValueScenario,rarityExclusions,standardBoxPacks} from "../core/domain/pack-value-scenario";

const quantity=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:3});
function frequency(tier:ValueBreakdownTier,packs:number){
 if(packs>1){
  const yieldPerPack=tier.perPack??(tier.packsPerHit?1/tier.packsPerHit:null);
  return yieldPerPack==null?"Pull rate unavailable":`≈ ${quantity(yieldPerPack*packs)} cards per box`;
 }
 if(tier.perPack!=null&&tier.perPack>0)return `${quantity(tier.perPack)}× per pack`;
 if(tier.packsPerHit!=null&&tier.packsPerHit>0)return `≈ 1 in ${quantity(tier.packsPerHit)} packs`;
 return "Pull rate unavailable";
}

export default function PackValueBreakdown({breakdown,game="",setName="",language="en"}:{breakdown:ValueBreakdown;game?:string;setName?:string;language?:string}){
 const id=useId();
 const [basis,setBasis]=useState("pack"),[excluded,setExcluded]=useState<string[]>([]);
 const boxPacks=standardBoxPacks(game,setName,language),isBox=basis==="box"&&boxPacks!=null;
 const packs=isBox?boxPacks:1,unit=isBox?"box":"pack";
 const options=rarityExclusions(game,breakdown.tiers);
 const scenario=packValueScenario(breakdown,excluded,packs);
 return <div className="pack-value-breakdown">
  <div className="pack-value-heading"><h3>Where the value sits</h3><p>Chase prints: <strong>{scenario.chaseShare==null?"N/A":`${(scenario.chaseShare*100).toFixed(1)}%`}</strong> of estimated subtotal</p></div>
  <div className="pack-value-controls">
   <label className="pack-value-basis" htmlFor={`${id}-basis`}>Show value<select id={`${id}-basis`} value={isBox?"box":"pack"} onChange={event=>setBasis(event.target.value)} aria-describedby={`${id}-box-note`}><option value="pack">Per pack</option><option value="box" disabled={boxPacks==null}>Per box</option></select></label>
   {options.length>0&&<fieldset><legend>Rarity exclusions</legend>{options.map(option=><label key={option.key}><input type="checkbox" checked={excluded.includes(option.key)} onChange={event=>setExcluded(current=>event.target.checked?[...current,option.key]:current.filter(key=>key!==option.key))}/>{option.label}</label>)}</fieldset>}
  </div>
  <p id={`${id}-box-note`} className="detail-note">{boxPacks==null?"Per box unavailable: no verified standard booster-box format for this set and language.":`Standard English booster box: ${boxPacks} packs. Promos and accessories excluded.`}</p>
  <div className="pack-value-total" role="status" aria-live="polite" aria-atomic="true"><span>Estimated partial value per {unit}{excluded.length>0?" · exclusions applied":""}</span><strong>{formatUsd(scenario.total,"N/A")}</strong></div>
  {excluded.length>0&&<p className="detail-note">Excluded tiers contribute no value in this scenario; their odds are not reassigned to other cards. This is not the expected value conditional on missing those pulls.</p>}
  <ul className="pack-value-tiers" aria-label={`Estimated ${unit} value by rarity`}>
   {scenario.tiers.map(tier=><li key={tier.key} className={`pack-value-tier${tier.chase?" is-chase":""}${tier.excluded?" is-excluded":""}`}>
    <div className="pack-value-tier-heading"><span>{tier.label}{tier.chase&&<span className="pack-chase-badge">Chase</span>}</span><strong>{tier.excluded?"Excluded":formatUsd(tier.value,"N/A")}</strong></div>
    <div className="pack-value-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,(tier.share??0)*100))}%`}}/></div>
    <p className="pack-value-facts"><span>{formatUsd(tier.average,"N/A")} avg</span><span>{frequency(tier,packs)}</span><span>{tier.pricedCount.toLocaleString()}/{tier.cardCount.toLocaleString()} priced</span><span>Top {formatUsd(tier.topMarket,"N/A")}</span><span>{tier.excluded?"Excluded from subtotal":tier.share==null?"Share unavailable":`${(tier.share*100).toFixed(1)}% of subtotal`}</span></p>
    {tier.pricedCount<tier.cardCount&&<p className="pack-value-unavailable">Incomplete pricing — this tier is excluded from estimated value.</p>}
   </li>)}
  </ul>
  <p className="detail-note">Partial long-run estimate, not guaranteed pack or box contents or a promised return. Missing prices are not treated as zero: incomplete tiers and unknown pull rates are excluded. Bars show shares of the estimated subtotal, not pull probabilities. Prices updated {breakdown.updatedAt?.slice(0,10)??"N/A"}.</p>
  {!!breakdown.missingTiers?.length&&<p className="detail-note">Missing price groups: {breakdown.missingTiers.join(", ")}.</p>}
 </div>;
}
