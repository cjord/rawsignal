import type {AuctionCard,AuctionStatistics} from './auction-types.ts';
import type {AuctionCatalogManifest} from './auction-catalog-snapshot.ts';
export type PublicAuctionSettings={id:string|null;displayName:string;showcasePublic:boolean;leaderboardPublic:boolean;updatedAt:string|null;moderationHidden?:boolean};
export type AuctionCommunityRow={id:string;displayName:string;showcasePublic:boolean;profit:number;settled:number;won:number;updatedAt:string;showcaseValue?:number|null;knownValue?:number;cardCount?:number;unpriced?:number};
export type AuctionCommunityPage={rows:AuctionCommunityRow[];nextCursor:string|null;offset:number;marketSnapshot?:Pick<AuctionCatalogManifest,'source'|'asOf'>|null};
export type PublicAuctionProfile={id:string;displayName:string;showcasePublic:boolean;stats:AuctionStatistics;cards:(Omit<AuctionCard,'cents'>&{cents:number|null})[];backdrop?:{image:string;rarity:string;section:string}[];updatedAt:string;priceSource:string|null};
export const publicProfileId=(value:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const publicProfilePath=(id:string)=>`/games/riftbound-auction/players/${id}`;
export type AuctionVisibility=Pick<PublicAuctionSettings,'showcasePublic'|'leaderboardPublic'>;
export function communityQuery(params:URLSearchParams){
 const keys=[...params.keys()];
 if(keys.some(key=>!['view','cursor'].includes(key))||new Set(keys).size!==keys.length)return null;
 const view=params.get('view')??'leaderboard',cursor=params.get('cursor');
 if(!['leaderboard','showcases'].includes(view)||cursor!==null&&(cursor.length>512||!cursor.trim()))return null;
 return {view:view as 'leaderboard'|'showcases',cursor};
}
export function validPublicSettings(value:unknown):value is AuctionVisibility{
 if(!value||typeof value!=='object')return false;const row=value as Record<string,unknown>;
 return Object.keys(row).every(key=>['showcasePublic','leaderboardPublic'].includes(key))&&typeof row.showcasePublic==='boolean'&&typeof row.leaderboardPublic==='boolean';
}
