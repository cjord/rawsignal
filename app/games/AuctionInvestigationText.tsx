"use client";
import {investigationDescription} from '../../core/domain/auction-investigations-v4';
import {useAuctionGame} from './AuctionGameContext';
import {pokemonAuctionText} from './pokemon-auction-presentation';

export const investigationUsd=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100);
const bands:Record<string,string>={common:'common',uncommon:'uncommon',rare:'rare',epic:'epic','alt art':'alt','alt-art':'alt',overnumbered:'premium',signature:'premium',promo:'promo',showcase:'promo',metal:'promo'};
export default function AuctionInvestigationText({text}:{text:string}){
 const game=useAuctionGame(),display=game.market==='pokemon'?pokemonAuctionText(text):text;
 return <>{investigationDescription(display).split(/(\b(?:ultra[- ]rares?|Alt[- ]Arts?|Overnumbered|Signatures?|Uncommons?|Commons?|Rares?|Epics?|Promos?|Showcase|Metal)\b)/gi).map((part,index)=>{
  const band=bands[part.toLowerCase().replace(/s$/,'')];
  return band?<span className="auction-investigation-rarity" data-rarity={band} key={index}>{part}</span>:part;
 })}</>;
}
