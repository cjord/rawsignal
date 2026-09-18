import type {PackProfile,PullRateEvidence} from "../core/domain/pack-profile";
import type {ValueBreakdown} from "../core/domain/types";
import PackValueBreakdown from "./PackValueBreakdown";

export default function PackProfilePanel({profile,evidence,breakdown,setName=""}:{profile?:PackProfile|null;evidence?:PullRateEvidence|null;breakdown?:ValueBreakdown|null;setName?:string}){
 if(!profile)return null;
 return <section className="detail-section pack-profile-panel" aria-label="Pack composition and estimated value">
  <header><span>{profile.language==="ja"?"Japanese":"English"} booster · {profile.cardsPerPack??"Unknown"} cards</span><h2>Pack breakdown</h2></header>
  <div className="detail-table-scroll"><table className="detail-variants-table pack-composition-table"><thead><tr><th scope="col">Pack slot</th><th scope="col">Cards</th></tr></thead><tbody>
   {profile.slots.map(slot=><tr key={slot.label}><th scope="row">{slot.label}</th><td>{slot.count}</td></tr>)}
  </tbody></table></div>
  <p className="detail-note">{profile.notes}</p>
  {breakdown?<PackValueBreakdown key={`${profile.id}:${setName}`} breakdown={breakdown} game={profile.game} language={profile.language} setName={setName}/>:<p className="detail-unavailable">{evidence?"Full rarity pricing is not available yet. Pack value breakdown unavailable.":"Set-specific pull rates unavailable. Pack value breakdown unavailable."}</p>}
  {evidence&&<p className="detail-note">{evidence.basis==="publisher"?"Publisher estimates":"Observed opening estimates"}{evidence.sampleSizeMinimum!=null?` · sample reported at approximately ${evidence.sampleSizeMinimum.toLocaleString()} packs or more`:""} · reviewed {evidence.reviewedAt}. {evidence.notes}</p>}
  <p className="detail-note">{[...new Set([...profile.sources,...(evidence?.sources??[])])].map((url,index)=><span key={url}>{index>0?" · ":""}<a href={url} target="_blank" rel="noopener noreferrer">Source {index+1}</a></span>)}</p>
 </section>;
}
