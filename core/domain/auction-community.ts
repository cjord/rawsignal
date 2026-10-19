import type {AuctionCard,AuctionStatistics} from './auction-types.ts';
export type PublicAuctionSettings={id:string|null;displayName:string;showcasePublic:boolean;leaderboardPublic:boolean;updatedAt:string|null};
export type AuctionCommunityRow={id:string;displayName:string;showcasePublic:boolean;profit:number;settled:number;won:number;updatedAt:string};
export type AuctionCommunityPage={rows:AuctionCommunityRow[];nextCursor:string|null;offset:number};
export type PublicAuctionProfile={id:string;displayName:string;showcasePublic:boolean;stats:AuctionStatistics;cards:(Omit<AuctionCard,'cents'>&{cents:number|null})[];updatedAt:string;priceSource:string|null};
export const publicProfileId=(value:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const publicProfilePath=(id:string)=>`/games/riftbound-auction/players/${id}`;
export function validPublicSettings(value:unknown):value is Omit<PublicAuctionSettings,'id'|'updatedAt'>{
 if(!value||typeof value!=='object')return false;const row=value as Record<string,unknown>;
 return Object.keys(row).every(key=>['displayName','showcasePublic','leaderboardPublic'].includes(key))&&typeof row.displayName==='string'&&row.displayName.trim().length>0&&row.displayName.length<=40&&Array.from(row.displayName).every(char=>char.charCodeAt(0)>31&&char.charCodeAt(0)!==127)&&typeof row.showcasePublic==='boolean'&&typeof row.leaderboardPublic==='boolean';
}
