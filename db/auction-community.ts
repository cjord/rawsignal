import {publishedIngestion,type D1DatabaseLike} from './repository.ts';
import {parseAuctionSave} from '../core/domain/auction-save.ts';
import {emptyAuctionStatistics} from '../core/domain/auction-statistics.ts';
import {publicProfileId,type AuctionVisibility,type PublicAuctionSettings,type AuctionCommunityRow,type AuctionCommunityPage,type PublicAuctionProfile} from '../core/domain/auction-community.ts';
import {riftboundRegularArtworkImage} from '../core/domain/riftbound-artwork.ts';
import {readyCatalogRun} from './readiness.ts';
import {AUCTION_APPEARANCE_KEY,parseAuctionAppearance} from '../core/domain/auction-appearance.ts';
const gameKey='raw-signal-auction-house-v1';
type SettingsRow={id:string;displayName:string;showcasePublic:number;leaderboardPublic:number;updatedAt:string;moderationHidden?:number};
const settings=({moderationHidden,...row}:SettingsRow):PublicAuctionSettings=>({...row,showcasePublic:!!row.showcasePublic,leaderboardPublic:!!row.leaderboardPublic,...(moderationHidden===undefined?{}:{moderationHidden:!!moderationHidden})});
export async function ownAuctionProfile(db:D1DatabaseLike,userId:string,moderation=false){
 const extra=moderation?',COALESCE(m.hidden,0) AS moderationHidden':'',join=moderation?' LEFT JOIN auction_profile_moderation m ON m.profile_id=p.id':'';
 const row=await db.prepare(`SELECT p.id,COALESCE(u.public_username,'') AS displayName,p.showcase_public AS showcasePublic,p.leaderboard_public AS leaderboardPublic,p.updated_at AS updatedAt${extra} FROM auth_user u LEFT JOIN auction_public_profiles p ON p.user_id=u.id${join} WHERE u.id=?`).bind(userId).first<SettingsRow>();
 return row?{...settings(row),updatedAt:row.updatedAt??null,...(moderation?{moderationHidden:!!row.moderationHidden}:{})}:{id:null,displayName:'',showcasePublic:false,leaderboardPublic:false,updatedAt:null};
}
export async function writePublicAuctionSettings(db:D1DatabaseLike,userId:string,value:AuctionVisibility,moderation=false){
 // Derive scores only from the session owner's existing cloud document. The
 // browser does not get a separate arbitrary-score submission endpoint.
 await db.prepare(`WITH saved AS (SELECT value_json FROM account_documents WHERE user_id=? AND document_key=?) INSERT INTO auction_public_profiles(id,user_id,display_name,showcase_public,leaderboard_public,profit_cents,settled,won,updated_at) SELECT ?,id,COALESCE(public_username,''),?,?,COALESCE((SELECT json_extract(value_json,'$.statistics.profit') FROM saved),0),COALESCE((SELECT json_extract(value_json,'$.statistics.settled') FROM saved),0),COALESCE((SELECT json_extract(value_json,'$.statistics.won') FROM saved),0),? FROM auth_user WHERE id=? AND ((?=0 AND ?=0) OR length(trim(public_username))>0) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,showcase_public=excluded.showcase_public,leaderboard_public=excluded.leaderboard_public,profit_cents=excluded.profit_cents,settled=excluded.settled,won=excluded.won,updated_at=excluded.updated_at`).bind(userId,gameKey,crypto.randomUUID(),Number(value.showcasePublic),Number(value.leaderboardPublic),new Date().toISOString(),userId,Number(value.showcasePublic),Number(value.leaderboardPublic)).run();
 return ownAuctionProfile(db,userId,moderation);
}
function communityCursor(raw:string|null,mode:string){
 if(!raw)return null;
 try{const row=JSON.parse(raw);if(!Array.isArray(row)||row.length!==5||row[0]!==mode||!Number.isSafeInteger(row[1])||!Number.isSafeInteger(row[2])||row[2]<0||!publicProfileId(String(row[3]))||!Number.isSafeInteger(row[4])||row[4]<0||row[4]>10000)throw new Error();return row as [string,number,number,string,number]}catch{throw new Error('Invalid community cursor')}
}
export async function auctionCommunityPage(db:D1DatabaseLike,mode:'leaderboard'|'showcases',rawCursor:string|null,moderation=false,identity?:D1DatabaseLike):Promise<AuctionCommunityPage>{
 const cursor=communityCursor(rawCursor,mode),offset=cursor?.[4]??0,args:unknown[]=[];
 // Only opted-in showcase slots (maximum 20 per account), never inventory or
 // auction history. Prices are joined on read; daily ingestion has no new writes.
 const published=mode==='showcases'?await readyCatalogRun(db):await publishedIngestion(db).catch(()=>null),visible=moderation?' AND NOT EXISTS(SELECT 1 FROM auction_profile_moderation m WHERE m.profile_id=p.id AND m.hidden=1)':'';
 const valueCte=mode==='showcases'?`WITH values_by_profile AS (
 SELECT p.id,COUNT(j.key) AS cardCount,COALESCE(SUM(c.market_cents),0) AS knownValue,
 SUM(CASE WHEN j.key IS NOT NULL AND c.market_cents IS NULL THEN 1 ELSE 0 END) AS unpriced
 FROM auction_public_profiles p JOIN auth_user u ON u.id=p.user_id AND length(trim(u.public_username))>0
 LEFT JOIN account_documents d ON d.user_id=p.user_id AND d.document_key=?
 LEFT JOIN json_each(COALESCE(json_extract(d.value_json,'$.showcase'),'[]')) j ON CAST(j.key AS INTEGER)<20
 LEFT JOIN catalog_products cp ON cp.product_id=json_extract(j.value,'$.productId') AND cp.printing=json_extract(j.value,'$.printing') AND cp.kind='single' AND cp.game='riftbound' AND cp.ingestion_run_id=?
 LEFT JOIN current_prices c ON c.product_id=cp.product_id AND c.ingestion_run_id=cp.ingestion_run_id
 WHERE p.showcase_public=1${visible} GROUP BY p.id
 ), ranked AS (SELECT p.*,u.public_username AS username,v.cardCount,v.knownValue,v.unpriced,CASE WHEN v.unpriced=0 THEN v.knownValue ELSE -1 END AS sort_value FROM auction_public_profiles p JOIN values_by_profile v ON v.id=p.id JOIN auth_user u ON u.id=p.user_id)`:`WITH ranked AS (SELECT p.*,u.public_username AS username,profit_cents AS sort_value FROM auction_public_profiles p JOIN auth_user u ON u.id=p.user_id WHERE p.leaderboard_public=1 AND p.settled>0 AND length(trim(u.public_username))>0${visible})`;
 if(mode==='showcases')args.push(gameKey,published?.runId??null);
 const tie=mode==='leaderboard'?'settled':'0',where=cursor?`WHERE (sort_value<? OR (sort_value=? AND ${tie}<?) OR (sort_value=? AND ${tie}=? AND id>?))`:'';
 if(cursor)args.push(cursor[1],cursor[1],cursor[2],cursor[1],cursor[2],cursor[3]);
 const extra=mode==='showcases'?',CASE WHEN sort_value>=0 THEN sort_value ELSE NULL END AS showcaseValue,knownValue,cardCount,unpriced':'';
 const result=await db.prepare(`${valueCte} SELECT id,user_id AS ownerId,username AS displayName,showcase_public AS showcasePublic,profit_cents AS profit,settled,won,updated_at AS updatedAt${extra} FROM ranked ${where} ORDER BY sort_value DESC,${mode==='leaderboard'?'settled DESC,':''}id LIMIT 26`).bind(...args).all<AuctionCommunityRow&{ownerId:string}>();
 if(!result.results)throw new Error('Community unavailable');
 const page=result.results.slice(0,25),last=page.at(-1);
 const rows=await visibleCommunityRows(page,identity);
 return {rows,offset,marketSnapshot:published?{source:'database',asOf:published.sourceUpdatedAt}:null,nextCursor:result.results.length>25&&last?JSON.stringify([mode,mode==='leaderboard'?last.profit:last.showcaseValue??-1,mode==='leaderboard'?last.settled:0,last.id,offset+page.length]):null};
}
async function visibleCommunityRows(page:(AuctionCommunityRow&{ownerId:string})[],identity?:D1DatabaseLike){
 const owners=identity&&page.length?await identity.prepare(`SELECT id FROM auth_user WHERE id IN (${page.map(()=>'?').join(',')})`).bind(...page.map(row=>row.ownerId)).all<{id:string}>():null;
 if(owners&&!owners.results)throw new Error('Identity visibility unavailable');
 const live=owners?new Set(owners.results!.map(row=>row.id)):null;
 return page.filter(row=>!live||live.has(row.ownerId)).map(({ownerId,...row})=>{void ownerId;return {...row,showcasePublic:!!row.showcasePublic}});
}
export async function publicAuctionProfile(db:D1DatabaseLike,id:string,moderation=false,identity?:D1DatabaseLike):Promise<PublicAuctionProfile|null>{
 const visible=moderation?' AND NOT EXISTS(SELECT 1 FROM auction_profile_moderation m WHERE m.profile_id=p.id AND m.hidden=1)':'';
 const row=await db.prepare(`SELECT p.id,u.public_username AS displayName,p.showcase_public AS showcasePublic,p.updated_at AS updatedAt,d.value_json AS value,a.value_json AS appearance FROM auction_public_profiles p JOIN auth_user u ON u.id=p.user_id AND length(trim(u.public_username))>0 LEFT JOIN account_documents d ON d.user_id=p.user_id AND d.document_key=? LEFT JOIN account_documents a ON a.user_id=p.user_id AND a.document_key=? WHERE p.id=? AND (p.showcase_public=1 OR p.leaderboard_public=1)${visible}`).bind(gameKey,AUCTION_APPEARANCE_KEY,id).first<{id:string;displayName:string;showcasePublic:number;updatedAt:string;value:string|null;appearance:string|null}>();
 if(!row)return null;
 if(identity){
  const owner=await db.prepare('SELECT user_id AS id FROM auction_public_profiles WHERE id=?').bind(id).first<{id:string}>();
  if(!owner||!await identity.prepare('SELECT id FROM auth_user WHERE id=?').bind(owner.id).first())return null;
 }
 const save=row.value?parseAuctionSave(row.value):null,stored=save?.statistics??emptyAuctionStatistics(),stats=Object.fromEntries(Object.keys(emptyAuctionStatistics()).map(key=>[key,stored[key as keyof typeof stored]])) as typeof stored,holdings=row.showcasePublic?save?.showcase??[]:[];
 const decoration=publicBackdropHoldings(!!row.showcasePublic,row.appearance);
 const ids=[...new Set([...holdings,...decoration].map(card=>card.productId))],published=ids.length?await readyCatalogRun(db):null;
 type CardRow={productId:number;printing:string;name:string;image:string|null;number:string|null;set:string;rarity:string;section:string;cents:number|null};
 const result=published&&ids.length?await db.prepare(`SELECT p.product_id AS productId,COALESCE(p.printing,'Normal') printing,p.name,p.image_url AS image,p.card_number AS number,p.set_name AS "set",COALESCE(p.rarity,'Unknown') rarity,COALESCE(p.section,'') section,c.market_cents AS cents FROM catalog_products p LEFT JOIN current_prices c ON c.product_id=p.product_id AND c.ingestion_run_id=p.ingestion_run_id WHERE p.game='riftbound' AND p.kind='single' AND p.ingestion_run_id=? AND p.product_id IN (${ids.map(()=>'?').join(',')})`).bind(published.runId,...ids).all<CardRow>():{results:[]};
 const metadata=new Map((result.results??[]).map(card=>[card.productId,card]));
 const cards=holdings.map(holding=>{const card=metadata.get(holding.productId);return {productId:holding.productId,printing:holding.printing,name:card?.name??`Card ${holding.productId}`,set:card?.set??'',rarity:card?.rarity??'Unknown',section:card?.section??'',image:card?riftboundRegularArtworkImage({game:'riftbound',name:card.name,number:card.number})??card.image??'':'',cents:card&&card.printing===holding.printing?card.cents:null}});
 const backdrop=decoration.flatMap(holding=>{const card=metadata.get(holding.productId);if(!card||card.printing!==holding.printing)return [];const image=riftboundRegularArtworkImage({game:'riftbound',name:card.name,number:card.number})??card.image??'';return /^https?:\/\//.test(image)?[{image,rarity:card.rarity,section:card.section}]:[]});
 return {id:row.id,displayName:row.displayName,showcasePublic:!!row.showcasePublic,updatedAt:row.updatedAt,stats,cards,backdrop,priceSource:published?.sourceUpdatedAt??null};
}
function publicBackdropHoldings(isPublic:boolean,raw:string|null){
 if(!isPublic)return [];
 try{return parseAuctionAppearance(raw).cards}catch{return []}
}
