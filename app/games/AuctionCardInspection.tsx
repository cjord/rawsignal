"use client";
import {useArtTilt} from '../hooks/useArtTilt';
import DeferredImage from '../DeferredImage';
import AuctionDialog from './AuctionDialog';
import {auctionRarity,auctionValueEffect} from '../../core/domain/auction-display';
import type {AuctionCard} from '../../core/domain/auction-types';
import {auctionUsd} from './AuctionWallet';

export default function AuctionCardInspection({card,priceKnown=true,close}:{card:AuctionCard;priceKnown?:boolean;close:()=>void}){
 const [artRef,tilt]=useArtTilt();
 return <AuctionDialog title={card.name} onClose={close} dismissOnOutside><div className="auction-inspection" ref={artRef} {...tilt} data-rarity={auctionRarity(card)} data-value-effect={auctionValueEffect(card.cents,priceKnown)}><DeferredImage className="auction-inspect-art" src={card.image} alt={card.name}/><p>{card.printing} · {card.set}</p><strong>{priceKnown?(card.cents?auctionUsd(card.cents):'Price Unavailable'):'Price Unknown'}</strong></div></AuctionDialog>;
}
