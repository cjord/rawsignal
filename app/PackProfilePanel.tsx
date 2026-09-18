import type {PackProfile,PullRateEvidence} from "../core/domain/pack-profile";
import type {ValueBreakdown} from "../core/domain/types";
import {formatUsd} from "../core/domain/formatters";

export default function PackProfilePanel({profile,evidence,breakdown}:{profile?:PackProfile|null;evidence?:PullRateEvidence|null;breakdown?:ValueBreakdown|null}){
 if(!profile)return null;
 return <section className="detail-section pack-profile-panel" aria-label="Pack composition and estimated value">
  <header><span>{profile.language==="ja"?"Japanese":"English"} booster · {profile.cardsPerPack??"Unknown"} cards</span><h2>Pack breakdown</h2></header>
  <div className="detail-table-scroll"><table className="detail-variants-table pack-composition-table"><thead><tr><th scope="col">Pack slot</th><th scope="col">Cards</th></tr></thead><tbody>
   {profile.slots.map(slot=><tr key={slot.label}><th scope="row">{slot.label}</th><td>{slot.count}</td></tr>)}
  </tbody></table></div>
  <p className="detail-note">{profile.notes}</p>
  {breakdown?<>
   <p>Estimated partial value per pack: <strong>{formatUsd(breakdown.totalEv)}</strong></p>
   <div className="detail-table-scroll"><table className="detail-variants-table"><thead><tr><th scope="col">Rarity</th><th scope="col">Expected cards / pack</th><th scope="col">Priced cards</th><th scope="col">Estimated value</th></tr></thead><tbody>
    {breakdown.tiers.map(tier=><tr key={tier.key}><th scope="row">{tier.label}</th><td>{tier.perPack!=null?tier.perPack.toLocaleString(undefined,{maximumFractionDigits:3}):tier.packsPerHit!=null?(1/tier.packsPerHit).toLocaleString(undefined,{maximumFractionDigits:4}):"N/A"}</td><td>{tier.pricedCount} / {tier.cardCount}</td><td>{formatUsd(tier.evPerPack,"N/A")}</td></tr>)}
   </tbody></table></div>
   <p className="detail-note">Partial estimate: unknown slots and tiers with missing prices are excluded. This is not a complete pack value or a promised return. Prices updated {breakdown.updatedAt?.slice(0,10)??"N/A"}.</p>
   {!!breakdown.missingTiers?.length&&<p className="detail-note">Missing price groups: {breakdown.missingTiers.join(", ")}.</p>}
  </>:<p className="detail-unavailable">{evidence?"Full rarity pricing is not available yet. Pack value breakdown unavailable.":"Set-specific pull rates unavailable. Pack value breakdown unavailable."}</p>}
  {evidence&&<p className="detail-note">{evidence.basis==="publisher"?"Publisher estimates":"Observed opening estimates"}{evidence.sampleSizeMinimum!=null?` · sample reported at approximately ${evidence.sampleSizeMinimum.toLocaleString()} packs or more`:""} · reviewed {evidence.reviewedAt}. {evidence.notes}</p>}
  <p className="detail-note">{[...new Set([...profile.sources,...(evidence?.sources??[])])].map((url,index)=><span key={url}>{index>0?" · ":""}<a href={url} target="_blank" rel="noopener noreferrer">Source {index+1}</a></span>)}</p>
 </section>;
}
