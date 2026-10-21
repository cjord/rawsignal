import type {Holding} from './owned-collections.ts';
export type HoldingHealth='all'|'missing-price'|'missing-cost'|'missing-sticker';
export function matchesHoldingHealth(holding:Holding,health:HoldingHealth){if(health==='missing-price')return holding.product.cents===null;if(health==='missing-cost')return holding.lots.some(lot=>lot.costCents===null);if(health==='missing-sticker')return holding.lots.some(lot=>lot.stickerCents===null);return true}
export function collectionHealth(holdings:Holding[]){return {missingPrices:holdings.filter(row=>matchesHoldingHealth(row,'missing-price')).length,missingCosts:holdings.filter(row=>matchesHoldingHealth(row,'missing-cost')).length,missingStickers:holdings.filter(row=>matchesHoldingHealth(row,'missing-sticker')).length,total:holdings.length}}
