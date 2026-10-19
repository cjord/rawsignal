import type {D1DatabaseLike} from './repository.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {emptyAuctionStatistics} from '../core/domain/auction-statistics.ts';
import {publicProfileId,type PublicAuctionSettings,type AuctionCommunityRow,type AuctionCommunityPage,type PublicAuctionProfile} from '../core/domain/auction-community.ts';
import {riftboundRegularArtworkImage} from '../core/domain/riftbound-artwork.ts';
import {readyCatalogRun} from './readiness.ts';
const gameKey='raw-signal-auction-house-v1';
type SettingsRow={id:string;displayName:string;showcasePublic:number;leaderboardPublic:number;updatedAt:string};
const settings=(row:SettingsRow):PublicAuctionSettings=>({...row,showcasePublic:!!row.showcasePublic,leaderboardPublic:!!row.leaderboardPublic});
export async function ownAuctionProfile(db:D1DatabaseLike,userId:string){
 const row=await db.prepare('SELECT id,display_name AS displayName,showcase_public AS showcasePublic,leaderboard_public AS leaderboardPublic,updated_at AS updatedAt FROM auction_public_profiles WHERE user_id=?').bind(userId).first<SettingsRow>();
 return row?settings(row):{id:null,displayName:'Player',showcasePublic:false,leaderboardPublic:false,updatedAt:null};
}
export async function writePublicAuctionSettings(db:D1DatabaseLike,userId:string,value:Omit<PublicAuctionSettings,'id'|'updatedAt'>){
 // Derive scores only from the session owner's existing cloud document. The
 // browser does not get a separate arbitrary-score submission endpoint.
 await db.prepare(`WITH saved AS (SELECT value_json FROM account_documents WHERE user_id=? AND document_key=?) INSERT INTO auction_public_profiles(id,user_id,display_name,showcase_public,leaderboard_public,profit_cents,settled,won,updated_at) VALUES(?,?,?,?,?,COALESCE((SELECT json_extract(value_json,'$.statistics.profit') FROM saved),0),COALESCE((SELECT json_extract(value_json,'$.statistics.settled') FROM saved),0),COALESCE((SELECT json_extract(value_json,'$.statistics.won') FROM saved),0),?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,showcase_public=excluded.showcase_public,leaderboard_public=excluded.leaderboard_public,profit_cents=excluded.profit_cents,settled=excluded.settled,won=excluded.won,updated_at=excluded.updated_at`).bind(userId,gameKey,crypto.randomUUID(),userId,value.displayName.trim(),Number(value.showcasePublic),Number(value.leaderboardPublic),new Date().toISOString()).run();
 return ownAuctionProfile(db,userId);
}
export async function auctionCommunityPage(db:D1DatabaseLike,mode:'leaderboard'|'showcases',rawCursor:string|null):Promise<AuctionCommunityPage>{
 let cursor:unknown[]|null=null,offset=0;
 if(rawCursor){try{cursor=JSON.parse(rawCursor);if(!Array.isArray(cursor)||cursor.length!==5||cursor[0]!==mode||!publicProfileId(String(cursor[3]))||!Number.isSafeInteger(cursor[4])||Number(cursor[4])<0||Number(cursor[4])>10000)throw new Error();offset=Number(cursor[4]);if(mode==='leaderboard'&&(!Number.isSafeInteger(cursor[1])||!Number.isSafeInteger(cursor[2])||Number(cursor[2])<0))throw new Error();if(mode==='showcases'&&(typeof cursor[1]!=='string'||!Number.isFinite(Date.parse(cursor[1]))))throw new Error()}catch{throw new Error('Invalid community cursor')}}
 const where=[mode==='leaderboard'?'leaderboard_public=1 AND settled>0':'showcase_public=1'],args:unknown[]=[];
 if(cursor){if(mode==='leaderboard'){where.push('(profit_cents<? OR (profit_cents=? AND settled<?) OR (profit_cents=? AND settled=? AND id>?))');args.push(cursor[1],cursor[1],cursor[2],cursor[1],cursor[2],cursor[3])}else{where.push('(updated_at<? OR (updated_at=? AND id>?))');args.push(cursor[1],cursor[1],cursor[3])}}
 const order=mode==='leaderboard'?'profit_cents DESC,settled DESC,id':'updated_at DESC,id';
 const result=await db.prepare(`SELECT id,display_name AS displayName,showcase_public AS showcasePublic,profit_cents AS profit,settled,won,updated_at AS updatedAt FROM auction_public_profiles WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 26`).bind(...args).all<AuctionCommunityRow>();
 if(!result.results)throw new Error('Community unavailable');
 const rows=result.results.slice(0,25).map(row=>({...row,showcasePublic:!!row.showcasePublic})),last=rows.at(-1);
 return {rows,offset,nextCursor:result.results.length>25&&last?JSON.stringify([mode,mode==='leaderboard'?last.profit:last.updatedAt,last.settled,last.id,offset+rows.length]):null};
}
export async function publicAuctionProfile(db:D1DatabaseLike,id:string):Promise<PublicAuctionProfile|null>{
 const row=await db.prepare(`SELECT p.id,p.display_name AS displayName,p.showcase_public AS showcasePublic,p.updated_at AS updatedAt,d.value_json AS value FROM auction_public_profiles p LEFT JOIN account_documents d ON d.user_id=p.user_id AND d.document_key=? WHERE p.id=? AND (p.showcase_public=1 OR p.leaderboard_public=1)`).bind(gameKey,id).first<{id:string;displayName:string;showcasePublic:number;updatedAt:string;value:string|null}>();
 if(!row)return null;
 const save=row.value?parseAuctionSave(row.value):null,stored=save?.statistics??emptyAuctionStatistics(),stats=Object.fromEntries(Object.keys(emptyAuctionStatistics()).map(key=>[key,stored[key as keyof typeof stored]])) as typeof stored,holdings=row.showcasePublic?save?.showcase??[]:[];
 const published=holdings.length?await readyCatalogRun(db):null,ids=[...new Set(holdings.map(card=>card.productId))];
 type CardRow={productId:number;printing:string;name:string;image:string|null;number:string|null;set:string;rarity:string;section:string;cents:number|null};
 const result=published&&ids.length?await db.prepare(`SELECT p.product_id AS productId,COALESCE(p.printing,'Normal') printing,p.name,p.image_url AS image,p.card_number AS number,p.set_name AS "set",COALESCE(p.rarity,'Unknown') rarity,COALESCE(p.section,'') section,c.market_cents AS cents FROM catalog_products p LEFT JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=p.ingestion_run_id WHERE p.game='riftbound' AND p.kind='single' AND p.ingestion_run_id=? AND p.product_id IN (${ids.map(()=>'?').join(',')})`).bind(published.runId,...ids).all<CardRow>():{results:[]};
 const metadata=new Map((result.results??[]).map(card=>[card.productId,card]));
 const cards=holdings.map(holding=>{const card=metadata.get(holding.productId);return {productId:holding.productId,printing:holding.printing,name:card?.name??`Card ${holding.productId}`,set:card?.set??'',rarity:card?.rarity??'Unknown',section:card?.section??'',image:card?riftboundRegularArtworkImage({game:'riftbound',name:card.name,number:card.number})??card.image??'':'',cents:card&&card.printing===holding.printing?card.cents:null}});
 return {id:row.id,displayName:row.displayName,showcasePublic:!!row.showcasePublic,updatedAt:row.updatedAt,stats,cards,priceSource:published?.sourceUpdatedAt??null};
}
