import {expect,test} from '@playwright/test';
import {initialAuctionSave} from '../../core/domain/auction-types';
import {collectBenchmarkSample,installBenchmarkObserver,benchmarkReport} from '../../scripts/performance/auction-benchmark.mjs';
const rows=Array.from({length:35},(_,i)=>({game:'riftbound',productId:995000+i,name:`Quality Card ${i}`,image:`https://art.example/${i}.svg`,marketPrice:i+1,printing:'Normal',section:'rares',set:'Origins',rarity:'Rare',year:2025,number:String(i),url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));

test('wallet summary keeps its mobile rows through pricing and knows empty inventory is worth zero',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('https://art.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'}));
 for(const owned of [false,true]){
  let release=()=>{};const held=new Promise<void>(done=>release=done);await page.route('**/data/*.json',async route=>{await held;await route.fulfill({json:rows})});
  const save=initialAuctionSave();if(owned)save.wallet.inventory=[{productId:rows[0].productId,printing:'Normal',quantity:1}];
  await page.addInitScript(save=>localStorage.setItem('raw-signal-auction-house-v1',JSON.stringify(save)),save);
  await page.goto('/games/riftbound-auction');await expect(page.locator('.auction-wallet .auction-net-worth')).toBeVisible();
  await expect(page.locator('.auction-wallet .auction-inventory-value')).toContainText(owned?'Loading…':'$0.00');
  const controls=page.locator('.auction-wallet[aria-label="Virtual bankroll and inventory"]>.auction-actions');await expect(controls).toBeVisible();
  const before=await controls.boundingBox();expect(before).not.toBeNull();release();
  await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true})).toBeEnabled();
  await expect(page.locator('.auction-wallet .auction-inventory-value')).toContainText(owned?'$0.90':'$0.00');
  await expect(controls).toBeVisible();const after=await controls.boundingBox();expect(after).not.toBeNull();expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);
 }
});
test('inventory loading reserves controls, never flashes a zero wallet and exits into retry on failure',async({page},testInfo)=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let failing=false,requests=0;
 await page.route('**/data/*.json',async route=>{requests++;await gate;return route.fulfill(failing?{status:503,json:{error:'offline'}}:{json:rows})});await page.route('https://art.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'}));
 const save=initialAuctionSave();save.wallet.cash=123400;save.wallet.inventory=rows.map(card=>({productId:card.productId,printing:card.printing,quantity:2}));await page.addInitScript(save=>localStorage.setItem('raw-signal-auction-house-v1',JSON.stringify(save)),save);
 await page.goto('/games/riftbound-auction/inventory');await expect(page.getByRole('status').filter({hasText:'Loading Inventory…'})).toBeVisible();await expect(page.locator('.auction-inventory-pending input')).toBeDisabled();await expect(page.locator('.auction-inventory-pending select')).toHaveCount(4);await expect(page.getByText('$0.00',{exact:true})).toHaveCount(0);
 await expect.poll(()=>requests).toBe(11); // Client hydration has begun its held catalog request wave.
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`inventory-pending-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
 release();await expect(page.locator('.auction-inventory-pending')).toHaveCount(0);await expect(page.getByText('$1,234.00',{exact:true})).toBeVisible();await expect(page.getByLabel('Find Cards')).toBeEnabled();
 failing=true;await page.reload();await expect(page.getByRole('button',{name:'Retry Catalog',exact:true})).toBeVisible();await expect(page.locator('.auction-inventory-pending')).toHaveCount(0);await expect(page.getByRole('button',{name:'Select This Page'})).toBeDisabled();await expect(page.getByText('$1,234.00',{exact:true})).toBeVisible();failing=false;await page.getByRole('button',{name:'Retry Catalog',exact:true}).click();await expect(page.getByRole('button',{name:'Select This Page'})).toBeEnabled();
});
test('opt-in benchmark collects bounded guest readiness and aggregate costs without entering auctions',async({page,context})=>{
 await installBenchmarkObserver(context);await page.route('**/data/*.json',route=>route.fulfill({json:rows}));await page.route('https://art.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'}));
 const base='http://localhost:4173',path='/games/riftbound-auction';
 const cold=await collectBenchmarkSample(page,path,'cold-document',()=>page.goto(base+path),base);expect(cold.readyMs).toBeGreaterThan(0);expect(cold.catalogRequests).toBe(11);expect(cold.d1RowsRead).toBeNull();
 const nav=await collectBenchmarkSample(page,path+'/inventory','client-navigation',()=>page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).click());expect(nav.sameDocument).toBe(true);expect(nav.catalogRequests).toBe(0);expect(cold.shiftSources).toBeInstanceOf(Array);expect(benchmarkReport([cold,nav],{baseUrl:base,samples:1}).groups).toHaveLength(2);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('raw-signal-auction-house-v1')??'null')?.auction??null)).toBeNull();
});
test('unrelated stalled artwork never blocks inventory metadata, prices or nearby images and space remains reserved',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),art=rows.map((row,index)=>({...row,image:index===0?'https://slow-art.example/held.svg':`https://ready-art.example/${index}.svg`}));
 await page.route('**/data/*.json',route=>route.fulfill({json:art}));await page.route('https://ready-art.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'}));await page.route('https://slow-art.example/**',async route=>{await gate;await route.fulfill({status:503,body:'unavailable'})});
 const save=initialAuctionSave();save.wallet.inventory=art.slice(0,3).map(card=>({productId:card.productId,printing:card.printing,quantity:1}));await page.addInitScript(save=>localStorage.setItem('raw-signal-auction-house-v1',JSON.stringify(save)),save);
 await page.goto('/games/riftbound-auction/inventory',{waitUntil:'domcontentloaded'});await expect(page.getByLabel('Find Cards')).toBeEnabled();await expect(page.getByRole('button',{name:'Select This Page'})).toBeEnabled();await expect(page.locator('.auction-owned-card')).toHaveCount(3);
 const stalled=page.locator('.auction-owned-card').filter({hasText:'Quality Card 0'}),other=page.locator('.auction-owned-card').filter({hasText:'Quality Card 1'});await expect(other.locator('.deferred-image')).toHaveClass(/is-loaded/);await expect(stalled.locator('strong')).toContainText('$0.90');const before=await stalled.boundingBox();release();await expect(stalled.locator('.image-fallback')).toBeVisible();const after=await stalled.boundingBox();expect(after?.height).toBe(before?.height);
});
