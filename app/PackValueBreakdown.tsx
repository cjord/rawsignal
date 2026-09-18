import type {ValueBreakdown,ValueBreakdownTier} from "../core/domain/types";
import {formatUsd} from "../core/domain/formatters";

const quantity=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:3});
function frequency(tier:ValueBreakdownTier){
 if(tier.perPack!=null&&tier.perPack>0)return `${quantity(tier.perPack)}× per pack`;
 if(tier.packsPerHit!=null&&tier.packsPerHit>0)return `≈ 1 in ${quantity(tier.packsPerHit)} packs`;
 return "Pull rate unavailable";
}

export default function PackValueBreakdown({breakdown}:{breakdown:ValueBreakdown}){
 return <div className="pack-value-breakdown">
  <div className="pack-value-heading"><h3>Where the value sits</h3><p>Chase prints: <strong>{breakdown.chaseShare==null?"N/A":`${(breakdown.chaseShare*100).toFixed(1)}%`}</strong> of estimated subtotal</p></div>
  <div className="pack-value-total"><span>Estimated partial value per pack</span><strong>{formatUsd(breakdown.totalEv,"N/A")}</strong></div>
  <ul className="pack-value-tiers" aria-label="Estimated pack value by rarity">
   {breakdown.tiers.map(tier=><li key={tier.key} className={tier.chase?"pack-value-tier is-chase":"pack-value-tier"}>
    <div className="pack-value-tier-heading"><span>{tier.label}{tier.chase&&<span className="pack-chase-badge">Chase</span>}</span><strong>{formatUsd(tier.evPerPack,"N/A")}</strong></div>
    <div className="pack-value-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,(tier.share??0)*100))}%`}}/></div>
    <p className="pack-value-facts"><span>{formatUsd(tier.average,"N/A")} avg</span><span>{frequency(tier)}</span><span>{tier.pricedCount.toLocaleString()}/{tier.cardCount.toLocaleString()} priced</span><span>Top {formatUsd(tier.topMarket,"N/A")}</span><span>{tier.share==null?"Share unavailable":`${(tier.share*100).toFixed(1)}% of subtotal`}</span></p>
    {tier.pricedCount<tier.cardCount&&<p className="pack-value-unavailable">Incomplete pricing — this tier is excluded from estimated value.</p>}
   </li>)}
  </ul>
  <p className="detail-note">Partial estimate, not a promised return. Missing prices are not treated as zero: incomplete tiers and unknown pull rates are excluded. Bars show shares of the estimated subtotal, not pull probabilities. Prices updated {breakdown.updatedAt?.slice(0,10)??"N/A"}.</p>
  {!!breakdown.missingTiers?.length&&<p className="detail-note">Missing price groups: {breakdown.missingTiers.join(", ")}.</p>}
 </div>;
}
