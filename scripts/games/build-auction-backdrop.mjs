// Generated decorative URLs only; no source fetch or displayed market values.
import fs from 'node:fs/promises';
import {allowedRarities} from '../../core/market-state.ts';
import {auctionBackdropImages} from '../../core/domain/auction-backdrop.ts';
const rows=[];
for(const section of allowedRarities.riftbound){const cards=JSON.parse(await fs.readFile(`public/data/${section}.json`,'utf8'));for(const card of cards)if(typeof card.image==='string')rows.push({image:card.image,rarity:card.rarity??'',section})}
const urls=new Set(auctionBackdropImages(rows,20261019,140)),cards=[...new Map(rows.filter(card=>urls.has(card.image)).map(card=>[card.image,card])).values()];
await fs.writeFile('app/data/auction-backdrop.json',JSON.stringify({source:'Bundled catalog; decorative URLs only',cards},null,2)+'\n');
console.log(`Generated ${cards.length} decorative card URLs; no external requests.`);
