// Read-only, explicitly selected source groups. Never writes feeds or D1.
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createTcgcsvClient} from '../../core/clients/tcgcsv.ts';
import {fetchText} from '../../core/clients/http-json.ts';
import {normalizeSinglesGroup} from '../../core/normalize/singles.ts';
import {ebayCardLanguage} from '../../core/domain/marketplace-links.ts';
import {POKEMON_BULK_SECTIONS} from '../../core/domain/pokemon-game-rarity.ts';
import {createGameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot.ts';

const ids=(process.argv[2]??'').split(',').map(Number);
if(ids.length>6||ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==ids.length)throw new Error('Provide 1–6 explicit Pokémon TCGCSV group IDs, comma-separated. Read-only audit.');
const stamp=()=>fetchText('https://tcgcsv.com/last-updated.txt',{headers:{'User-Agent':'RawSignal/7.0 (+validated daily market ingestion)'}}).then(value=>value.trim()).catch(()=>null);
const sourceUpdatedAt=await stamp(),client=createTcgcsvClient(),groups=await client.groups(3),rows=[];
for(const groupId of ids){
 const group=groups.find(g=>Number(g.groupId)===groupId);assert.ok(group,'Unknown Pokémon group '+groupId);
 const [products,prices]=await Promise.all([client.products(3,groupId),client.prices(3,groupId)]);
 const start=performance.now(),base=normalizeSinglesGroup({game:'pokemon',group,products,prices}).cards;
 const expanded=normalizeSinglesGroup({game:'pokemon',group,products,prices,includePokemonBulk:true}).cards;
 const elapsed=performance.now()-start,baselineIds=new Set(base.map(c=>c.productId));
 const bulk=expanded.filter(c=>!baselineIds.has(c.productId)&&ebayCardLanguage({...c,kind:'single'})==='English');
 assert.ok(bulk.every(c=>Object.values(POKEMON_BULK_SECTIONS).includes(c.section)),'Unexpected non-bulk admission');
 assert.equal(new Set([...base,...bulk].map(c=>c.productId)).size,base.length+bulk.length,'Duplicate identities in the combined pool');
 assert.deepEqual(expanded.filter(c=>baselineIds.has(c.productId)),base,'Expanded admission changed existing normalized cards');
 const snapshot=await createGameCatalogSnapshot([...base,...bulk],{market:'pokemon',eras:[],sets:[group.name]},'feed',sourceUpdatedAt,null),json=JSON.stringify(snapshot);
 const counts=key=>Object.fromEntries([...new Set(bulk.map(c=>c[key]))].sort().map(value=>[value,bulk.filter(c=>c[key]===value).length]));
 rows.push({groupId,name:group.name,sourceProducts:products.length,sourcePriceRows:prices.length,marketCards:base.length,additionalGameRows:bulk.length,stockByRarity:counts('rarity'),stockByPrinting:counts('printing'),scopedEligibleCards:snapshot.count,scopedPayloadBytes:Buffer.byteLength(json),scopedGzipBytes:gzipSync(json).length,normalizerDesktopMs:+elapsed.toFixed(2),existingNormalizedCardsUnchanged:true,additionalStockUpsertsPerWalk:bulk.length});
}
assert.equal(await stamp(),sourceUpdatedAt,'Source changed during audit; rerun rather than treating mixed snapshots as one');
console.log(JSON.stringify({readOnly:true,sourceUpdatedAt,sourceDateAvailable:sourceUpdatedAt!==null,sampledGroups:rows.length,scope:'Selected groups only; not full-catalog coverage, Worker CPU or a D1 cost measurement. Source date unavailable means cross-group freshness was not verified. Snapshot serialization is for payload sizing, not publication. Artwork URLs are validated structurally, not probed. Actual checkpointing may refetch a group across multiple batches.',rows},null,2));
