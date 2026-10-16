"use client";
import DeferredImage from '../DeferredImage';
import type {AuctionSave,AuctionCard,Holding} from '../../core/domain/auction-types';
import {holdingKey} from '../../core/domain/auction-types';
import {moveShowcaseCard,reorderShowcase,SHOWCASE_LIMIT} from '../../core/domain/auction-showcase';
import {auctionRarity} from '../../core/domain/auction-display';
import {auctionUsd} from './AuctionWallet';

type Props={save:AuctionSave;catalog:AuctionCard[];transact:(update:(save:AuctionSave)=>AuctionSave)=>unknown};
export default function AuctionShowcaseEditor({save,catalog,transact}:Props){
 const metadata=new Map(catalog.map(card=>[holdingKey(card),card])),selected=save.showcase??[];
 const move=(key:string,destination:'showcase'|'inventory')=>transact(current=>moveShowcaseCard(current,key,destination));
 const drop=(event:React.DragEvent,destination:'showcase'|'inventory',before?:string)=>{event.preventDefault();event.stopPropagation();try{const data=JSON.parse(event.dataTransfer.getData('application/x-raw-signal-card'));if(typeof data.key!=='string'||!['inventory','showcase'].includes(data.source))return;if(data.source===destination){if(before)transact(current=>reorderShowcase(current,data.key,before));}else move(data.key,destination)}catch{/* Unrelated drags do not change holdings. */}};
 const render=(holding:Holding,index:number,source:'inventory'|'showcase')=>{
  const key=holdingKey(holding),card=metadata.get(key),blocked=source==='inventory'&&(selected.length>=SHOWCASE_LIMIT||selected.some(row=>holdingKey(row)===key));
  return <article className="auction-owned-card auction-showcase-editor-card" data-rarity={auctionRarity(card)} key={key} draggable onDragStart={event=>event.dataTransfer.setData('application/x-raw-signal-card',JSON.stringify({key,source}))} onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,source,key)}>
   <DeferredImage src={card?.image} alt=""/><div><b>{card?.name??`Card ${holding.productId}`}</b><small>{holding.printing} · {card?.rarity??'Unknown'}{source==='inventory'?` · ×${holding.quantity}`:` · Slot ${index+1}`}</small><strong>{card?auctionUsd(card.cents):'Price Unavailable'}</strong><button className="game-control" type="button" disabled={blocked} onClick={()=>move(key,source==='inventory'?'showcase':'inventory')}>{source==='inventory'?'Add to Showcase':'Return to Inventory'}</button>{source==='showcase'&&<div className="auction-showcase-reorder"><button className="game-control" type="button" aria-label={`Move ${card?.name??holding.productId} earlier`} disabled={index===0} onClick={()=>transact(current=>reorderShowcase(current,key,holdingKey(selected[index-1])))}>←</button><button className="game-control" type="button" aria-label={`Move ${card?.name??holding.productId} later`} disabled={index===selected.length-1} onClick={()=>transact(current=>reorderShowcase(current,key,holdingKey(selected[index+1])))}>→</button></div>}</div>
  </article>;
 };
 return <div className="auction-showcase-editor">{(['inventory','showcase'] as const).map(source=><section className="detail-section" key={source} onDragOver={event=>event.preventDefault()} onDrop={event=>drop(event,source)} aria-label={source==='inventory'?'Sellable inventory':'Showcase cards'}><h2>{source==='inventory'?'Inventory':`Showcase (${selected.length} / ${SHOWCASE_LIMIT})`}</h2><p className="games-note">{source==='inventory'?'Drag a card across or select Add to Showcase. One copy of each printing can be displayed.':'Cards here cannot be sold. Return them to inventory to sell. Drag to reorder, or use the arrow buttons.'}</p><div className="auction-showcase-editor-list">{(source==='inventory'?save.wallet.inventory:selected).map((holding,index)=>render(holding,index,source))}</div>{!(source==='inventory'?save.wallet.inventory:selected).length&&<p className="games-note">{source==='inventory'?'No sellable cards. Win an auction or return a showcased card.':'Add up to 20 cards from your inventory.'}</p>}</section>)}</div>;
}
