import type {Auction,ClueReveal} from './auction-types.ts';

type Knowledge=Pick<Auction,'known'|'priced'|'rarityKnown'>;
// Snapshot only what this investigation newly disclosed, at its actual visibility.
// In particular, identity/rarity peeks must not turn into price reveals at settlement.
export function auctionClueReveals(before:Knowledge,after:Knowledge):ClueReveal[]{
 return [
  ...after.priced.filter(slot=>!before.priced.includes(slot)).map(slot=>({slot,visibility:'price' as const})),
  ...after.known.filter(slot=>!before.known.includes(slot)&&!after.priced.includes(slot)).map(slot=>({slot,visibility:'identity' as const})),
  ...(after.rarityKnown??[]).filter(slot=>!before.rarityKnown?.includes(slot)&&!after.known.includes(slot)).map(slot=>({slot,visibility:'rarity' as const})),
 ];
}
