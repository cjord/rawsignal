import {createRoot} from "react-dom/client";
import PackValueBreakdown from "../../app/PackValueBreakdown";
import {packValueBreakdown} from "../../core/domain/pack-ev";

const game=new URL(location.href).searchParams.get("fixtureGame")??"riftbound";
const pokemon=game==="pokemon";
const tiers=[
 {key:"Common",perPack:7,sumMarket:10,chase:false},
 {key:pokemon?"Special Illustration Rare":"signatures",packsPerHit:10,sumMarket:100,chase:true},
 {key:pokemon?"Hyper Rare":"overnumbered",packsPerHit:20,sumMarket:200,chase:true},
];
const breakdown=packValueBreakdown(tiers.map(t=>({label:t.key,perPack:null,packsPerHit:null,cardCount:10,pricedCount:10,topMarket:20,topProductId:1,...t})))!;
createRoot(document.getElementById("fixture")!).render(<PackValueBreakdown game={game} setName={pokemon?"SV01: Scarlet & Violet Base Set":"Origins"} breakdown={{...breakdown,updatedAt:"2026-09-18"}}/>);
