import type {D1DatabaseLike} from './repository.ts';
import type {Card,SealedProduct} from '../core/domain/types.ts';
import {POKEMON_BULK_SECTIONS} from '../core/domain/pokemon-game-rarity.ts';
import {ebayCardLanguage} from '../core/domain/marketplace-links.ts';
import {normalizeSinglesGroup,type SinglesPriceRow,type SinglesSourceProduct} from '../core/normalize/singles.ts';

export type GameStockCard=Card&{gameCatalogOnly:true};
export function normalizePokemonGameStock(group:{groupId:number;name:string;publishedOn:string},products:SinglesSourceProduct[],prices:SinglesPriceRow[]):GameStockCard[]{
 const normalized=normalizeSinglesGroup({game:'pokemon',group,products,prices,includePokemonBulk:true});
 const bulk=new Set<string>(Object.values(POKEMON_BULK_SECTIONS));
 return normalized.cards.filter(card=>bulk.has(card.section)&&ebayCardLanguage({...card,kind:'single'})==='English').map(card=>({...card,gameCatalogOnly:true}));
}
export async function persistGameStock(db:D1DatabaseLike,card:GameStockCard,observedAt:string,runId:string){
 if(card.marketPrice===null||!Number.isFinite(card.marketPrice)||!Number.isSafeInteger(Math.round(card.marketPrice*100))||Math.round(card.marketPrice*100)<=0)throw new Error('Invalid game stock price.');
 return db.prepare(`INSERT INTO game_catalog_stock(product_id,game,section,name,set_name,release_year,rarity,card_number,printing,image_url,source_url,market_cents,observed_at,ingestion_run_id)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET
 game=excluded.game,section=excluded.section,name=excluded.name,set_name=excluded.set_name,release_year=excluded.release_year,rarity=excluded.rarity,card_number=excluded.card_number,printing=excluded.printing,image_url=excluded.image_url,source_url=excluded.source_url,market_cents=excluded.market_cents,observed_at=excluded.observed_at,ingestion_run_id=excluded.ingestion_run_id
 WHERE game_catalog_stock.ingestion_run_id<>excluded.ingestion_run_id OR excluded.market_cents>game_catalog_stock.market_cents`).bind(card.productId,card.game,card.section,card.name,card.set,card.year,card.rarity,card.number,card.printing,card.image,card.url,Math.round(card.marketPrice*100),observedAt,runId).run();
}
export function gameStockSession(db:D1DatabaseLike,options:{enabled:boolean;resumed:boolean;previous:{gameStockEnabled?:boolean;gameStockProcessed?:number};observedAt:string;runId:string}){
 const {enabled,previous,observedAt,runId}=options;let processed=previous.gameStockProcessed??0;
 if(options.resumed&&!!previous.gameStockEnabled!==enabled)throw new Error('Game stock admission cannot change during an ingestion run.');
 const progress=()=>enabled?{gameStockEnabled:true,gameStockProcessed:processed}:{};
 return {enabled,progress,async persist(record:Card|SealedProduct){
  if(!('gameCatalogOnly' in record)||record.gameCatalogOnly!==true)return false;
  if(!enabled)throw new Error('Game stock admission is disabled.');
  await persistGameStock(db,record as GameStockCard,observedAt,runId);processed++;return true;
 },async completion(){
  if(!enabled)return {};
  const count=(await db.prepare('SELECT COUNT(*) AS n FROM game_catalog_stock WHERE ingestion_run_id=?').bind(runId).first<{n:number}>())?.n??0;
  return {...progress(),gameStockWritten:count};
 }};
}
