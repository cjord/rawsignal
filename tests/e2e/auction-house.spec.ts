import {expect,test,type Page} from '@playwright/test';

const key='raw-signal-auction-house-v1';
const rows=Array.from({length:24},(_,index)=>({game:'riftbound',productId:970000+index,name:`Auction Card ${index+1}`,image:`https://images.example/auction/${index}.svg`,marketPrice:index+1,printing:'Normal',section:'rares',set:'Origins',year:2025,number:String(index),rarity:index<12?'Common':'Rare',url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
async function fixtures(page:Page){
 await page.route('https://images.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
 await page.clock.install({time:new Date('2026-10-14T12:00:00Z')});
}
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
test('auction purchase, sealed lock, settlement, persisted live inventory, sale, fee and reset make no per-round pricing calls',async({page})=>{
 let requests=0,multiplier=1;
 await fixtures(page);await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows.map(card=>({...card,marketPrice:card.marketPrice*multiplier})))})});
 await page.goto('/games');await page.getByRole('link',{name:/Riftbound Auction House/}).click();
 await expect(page).toHaveTitle('Riftbound Auction House | Raw Signal');await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();
 await expect(page.locator('.auction-net-worth')).toContainText('$2,500.00 + ($0.00 cards)');
 await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:'Place your bid'})).toBeVisible();
 await expect(page.locator('.auction-npcs')).not.toContainText('$');await expect(page.locator('.auction-card')).toHaveCount(2);
 await expect(page.locator('.auction-hidden p')).not.toContainText(/\d/);
 const option=page.locator('.auction-offers button').first();await option.click();
 const afterBuy=await saved(page);expect(afterBuy.wallet.cash).toBe(250000-afterBuy.auction.spent);
 for(const button of await page.locator('.auction-offers button').all())await expect(button).toBeDisabled();
 await page.getByLabel('Bid (virtual USD)').fill(String(afterBuy.wallet.cash/100));await page.getByRole('button',{name:'Lock Bid',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Bid locked'})).toBeVisible();await expect(page.getByLabel('Bid (virtual USD)')).toHaveCount(0);
 await page.clock.runFor(3500);
 await expect(page.getByRole('heading',{name:'Auction settled'})).toBeVisible();
 const result=await saved(page);expect(result.auction.result.winner).toBe('You');expect(result.wallet.cash).toBe(0);
 expect(result.wallet.inventory.reduce((sum:number,row:{quantity:number})=>sum+row.quantity,0)).toBe(48);
 expect(result.wallet.inventory.every((row:Record<string,unknown>)=>Object.keys(row).sort().join(',')==='printing,productId,quantity')).toBe(true);
 await expect(page.locator('.auction-card')).toHaveCount(48);expect(requests).toBe(11);
 const worth=await page.locator('.auction-net-worth').textContent();
 multiplier=2;await page.reload();await expect(page.locator('.auction-net-worth')).not.toHaveText(worth!);
 const reloaded=await saved(page);expect(reloaded.wallet.cash).toBe(0);expect(reloaded.wallet.inventory).toEqual(result.wallet.inventory);expect(reloaded.auction.lot).toEqual(result.auction.lot);
 await page.getByRole('button',{name:'Finish & manage inventory'}).click();
 await page.locator('.auction-inventory summary').click();await page.getByRole('button',{name:'Sell priced inventory'}).click();
 await expect(page.getByRole('dialog',{name:'Sell priced inventory?'})).toBeVisible();expect((await saved(page)).wallet.inventory.length).toBe(24);
 await page.getByRole('button',{name:'Confirm sale'}).click();expect((await saved(page)).wallet.inventory).toHaveLength(0);
 expect((await saved(page)).wallet.cash).toBe(Math.round(result.auction.result.value*2*.9));
 await page.locator('.auction-fee summary').click();await page.getByLabel('Selling fee (%)').fill('15');await page.getByRole('button',{name:'Apply fee'}).click();expect((await saved(page)).wallet.feeBps).toBe(1500);
 await page.getByRole('button',{name:'Reset cash & inventory'}).click();await expect(page.getByRole('dialog',{name:'Reset your auction progress?'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();expect((await saved(page)).wallet.cash).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Reset cash & inventory'}).click();await page.getByRole('button',{name:'Confirm reset'}).click();
 expect((await saved(page)).wallet).toEqual({cash:250000,feeBps:1000,inventory:[]});expect(requests).toBe(22);
});
test('unsubmitted bid expires after reload, can advance independently and cannot buy twice',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();
 await page.locator('.auction-offers button').first().click();const bought=await saved(page);await page.reload();
 await expect(page.locator('.auction-offers button')).toHaveCount(3);for(const button of await page.locator('.auction-offers button').all())await expect(button).toBeDisabled();expect((await saved(page)).wallet.cash).toBe(bought.wallet.cash);
 await page.clock.runFor(27000);const timed=await saved(page);expect(timed.auction.selected).toBe(0);
 expect(timed.wallet.cash).toBe(bought.wallet.cash);expect(timed.auction.stage).not.toBe('round');
 if(timed.auction.stage==='reveal'){await page.getByRole('button',{name:'Next auction round'}).click();expect((await saved(page)).auction.round).toBe(2);expect((await saved(page)).auction.selected).toBeNull();await expect(page.locator('.auction-clues li')).toHaveCount(1)}
});
test('auction layouts and artwork are usable in both themes at desktop and mobile widths',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1100});await page.goto('/games');await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  const tile=page.getByRole('link',{name:/Riftbound Auction House/});await expect(tile.locator('.game-tile-art')).toHaveClass(/is-loaded/);
  await page.screenshot({path:testInfo.outputPath(`auction-tile-${width}-${theme}.png`),fullPage:true});await tile.click();
  await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  await page.getByRole('button',{name:'Enter free auction'}).click();
  await expect(page.locator('.auction-offers button')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/Inspect Auction Card/}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath(`auction-${width}-${theme}.png`),fullPage:true});
  await page.getByRole('button',{name:'Reset cash & inventory'}).click();await page.getByRole('button',{name:'Confirm reset'}).click();
 }
});
test('unpriced inventory stays owned and corrupted storage requires an explicit reset',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows.map((card,index)=>index===0?{...card,marketPrice:null}:card))}));
 await page.addInitScript(({key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,revision:0,sequence:0,wallet:{cash:10000,feeBps:1000,inventory:[{productId:970000,printing:'Normal',quantity:2},{productId:970001,printing:'Normal',quantity:1}]},auction:null}))},{key});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();
 await expect(page.locator('.auction-net-worth')).toContainText('N/A cards');await page.locator('.auction-inventory summary').click();await expect(page.locator('.auction-owned-card').first()).toContainText('Auction Card 1');
 await page.getByRole('button',{name:'Sell priced inventory'}).click();await page.getByRole('button',{name:'Confirm sale'}).click();expect((await saved(page)).wallet.inventory).toEqual([{productId:970000,printing:'Normal',quantity:2}]);
 await page.evaluate(key=>localStorage.setItem(key,'broken'),key);await page.goto('/games/riftbound-auction?corrupt=1');
 await expect(page.getByRole('alert')).toContainText('has not been overwritten');
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('broken');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Reset saved game'}).click();await expect(page.locator('.auction-net-worth')).toContainText('$2,500.00');
});
