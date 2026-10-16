import {expect,test,type Page} from '@playwright/test';
import {createDailyAuctionManifest} from '../../core/domain/auction-daily';
import {auctionCatalog} from '../../core/domain/auction-market';
import {initialAuctionSave} from '../../core/domain/auction-types';

const key='raw-signal-auction-house-v1';
const rows=Array.from({length:150},(_,index)=>({game:'riftbound' as const,productId:980000+index,name:`Daily Card ${index}`,image:`https://images.example/daily/${index}.svg`,marketPrice:50,printing:'Normal',section:'rares',set:'Origins',year:2025,number:String(index),rarity:'Rare',url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
const manifest=createDailyAuctionManifest(auctionCatalog(rows),'2026-10-16','daily-test');
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
async function setup(page:Page){
 await page.clock.install({time:new Date('2026-10-16T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
 await page.route('**/data/*.json',route=>route.fulfill({json:rows}));await page.route('**/api/auction/daily',route=>route.fulfill({json:manifest}));
 await page.route('https://images.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
 await page.goto('/games/riftbound-auction/daily');
}
test('daily five-auction run persists, auto-sells, credits profit once and preserves attempt on normal reset',async({page},testInfo)=>{
 await setup(page);await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();
 await expect(page.getByRole('button',{name:'Enter Auction 1 · Free',exact:true})).toBeVisible();
 expect((await saved(page)).wallet.cash).toBe(250000);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`daily-${width}-${theme}.png`),animations:'disabled'});}
 for(let index=0;index<5;index++){
  await page.getByRole('button',{name:`Enter Auction ${index+1} · ${index<3?'Free':'$50'}`,exact:true}).click();await page.getByRole('button',{name:'Skip Intro',exact:true}).click();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
  const state=await saved(page);expect(state.daily.save.auction.lot).toEqual(manifest.auctions[index].lot);expect(state.daily.save.auction.marketPrior).toEqual(manifest.auctions[index].marketPrior);
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.daily.save.auction.npcs=state.daily.save.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
  await page.getByLabel('Bid (virtual USD)').fill('10');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(3000);await expect(page.getByRole('heading',{name:'Auction Settled',exact:true})).toBeVisible();
  const skip=page.getByRole('button',{name:'Skip Reveal',exact:true});if(await skip.isVisible())await skip.click();const finish=page.getByRole('button',{name:index===4?'Complete Challenge':'Continue Daily Challenge',exact:true});await expect(finish).toBeEnabled();
  expect((await saved(page)).daily.save.wallet.inventory).toEqual([]);await finish.click();if(index===1){await page.reload();await expect(page.getByRole('button',{name:'Enter Auction 3 · Free',exact:true})).toBeVisible();}
 }
 const completed=await saved(page);expect(completed.daily.status).toBe('completed');expect(completed.wallet.cash).toBe(250000+completed.daily.reward);expect(completed.daily.reward).toBeGreaterThan(25000);
 await page.reload();expect((await saved(page)).wallet.cash).toBe(completed.wallet.cash);await expect(page.getByRole('button',{name:'Start Daily Challenge',exact:true})).toHaveCount(0);
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Reset cash & inventory',exact:true}).click();await page.getByRole('button',{name:'Confirm reset',exact:true}).click();expect((await saved(page)).daily.status).toBe('completed');
 await page.goto('/games/riftbound-auction/daily');await expect(page.getByRole('button',{name:'Start Daily Challenge',exact:true})).toHaveCount(0);
});
test('unavailable manifest never consumes an attempt; expiry removes the run without a reward',async({page})=>{
 await setup(page);await page.route('**/api/auction/daily',route=>route.fulfill({status:503,json:{error:'unavailable'}}));await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();await expect(page.getByRole('alert')).toContainText('attempt has not started');expect(await saved(page)).toBeNull();
 await page.unroute('**/api/auction/daily');await page.route('**/api/auction/daily',route=>route.fulfill({json:manifest}));await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();await expect(page.getByRole('button',{name:'Enter Auction 1 · Free',exact:true})).toBeVisible();
 await page.clock.setSystemTime(new Date('2026-10-17T00:00:00Z'));await page.clock.runFor(300);await expect(page.getByRole('button',{name:'Start Daily Challenge',exact:true})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(initialAuctionSave().wallet.cash);
});
test('normal auction statistics remain readable at mobile/desktop widths and in both themes',async({page},testInfo)=>{
 await setup(page);
 const initial=initialAuctionSave(),state={...initial,wallet:{...initial.wallet,feeBps:1250},statistics:{started:5,settled:4,won:3,abandoned:1,investigations:3500,entryFees:10000,profit:12345,rebates:500,bestProfit:10000,buyouts:2}};
 await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key,state});await page.goto('/games/riftbound-auction');
 const stats=page.locator('.auction-statistics');await expect(stats).toContainText('75.0%');await expect(stats).toContainText('$123.45');await expect(stats).toContainText('$35.00');
 await expect(stats.locator('[data-stat-tone]')).toHaveCount(8);await expect(stats.locator('[data-stat-tone="gain"]')).toHaveCount(4);await expect(stats.locator('[data-stat-tone="cost"]')).toHaveCount(1);
 await expect(page.getByText('12.5% Selling Fee',{exact:true})).toBeVisible();await expect(page.getByText('3 Rival Bidders',{exact:true})).toBeVisible();await expect(page.locator('.auction-lobby-backdrop')).toHaveAttribute('aria-hidden','true');await expect(page.locator('.auction-lobby-backdrop')).toHaveCSS('position','fixed');await expect(page.locator('.auction-lobby-backdrop img')).toHaveCount(40);
 const paid=page.getByRole('button',{name:'Enter Paid Auction · $50 Fee',exact:true});await expect(paid.locator('.auction-entry-fee')).toHaveText('$50 Fee');await expect(paid.locator('.auction-entry-fee')).not.toHaveCSS('color',await paid.locator('strong').evaluate(node=>getComputedStyle(node).color));
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-lobby-backdrop .auction-entry-art-lane').first()).toHaveCSS('animation-name','none');
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await stats.screenshot({path:testInfo.outputPath(`statistics-${width}-${theme}.png`)});await page.locator('.auction-lobby').screenshot({path:testInfo.outputPath(`lobby-${width}-${theme}.png`)});}
});
