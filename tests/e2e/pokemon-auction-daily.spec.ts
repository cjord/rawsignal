import {test,expect,type Page} from '@playwright/test';
import {pokemonAuctionDailyFixture} from '../helpers/pokemon-auction-daily-fixture';
import {initialAuctionSave} from '../../core/domain/auction-types';
import {auctionRunShare,gameSharePath} from '../../core/domain/game-sharing';
import {expectAuctionMarketFooter} from '../helpers/auction-market-footer';
const key='raw-signal-pokemon-auction-v1',riftKey='raw-signal-auction-house-v1';
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
async function setup(page:Page){
 const manifest=await pokemonAuctionDailyFixture(),rift=JSON.stringify({...initialAuctionSave(),sequence:29}),catalogReads:string[]=[];
 await page.addInitScript(({riftKey,rift})=>{if(!localStorage.getItem(riftKey))localStorage.setItem(riftKey,rift)},{riftKey,rift});
 await page.clock.install({time:new Date('2026-11-19T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-19T12:00:01Z'));
 await page.route('**/api/games/pokemon/auction/daily*',route=>route.fulfill({json:manifest}));
 await page.route('**/api/games/pokemon/catalog*',route=>{catalogReads.push(route.request().url());return route.fulfill({status:503,json:{error:'Daily should not download catalog'}})});
 await page.route('https://tcgplayer-cdn.tcgplayer.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#467ac4"/></svg>'}));
 await page.goto('/games/pokemon-auction/daily');return {manifest,rift,catalogReads};
}

test('Pokémon five-auction daily resumes, auto-sells, rewards once and shares frozen results without catalog downloads',async({page},info)=>{
 const {manifest,rift,catalogReads}=await setup(page);await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();await expect(page.getByRole('button',{name:'Enter Auction 1 · Free',exact:true})).toBeVisible();
 await expect(page.locator('.auction-daily-facts')).toContainText('3 Pewter + 2 Celadon');await page.emulateMedia({reducedMotion:'reduce'});
 for(let index=0;index<5;index++){
  await page.getByRole('button',{name:`Enter Auction ${index+1} · ${index<3?'Free':'$50'}`,exact:true}).click();await page.getByRole('button',{name:'Skip Intro',exact:true}).click();await expect(page.getByLabel('Bid (virtual USD)',{exact:true})).toBeVisible();
  expect((await saved(page)).daily.save.auction.lot).toEqual(manifest.auctions[index].lot);if(index===0)await expectAuctionMarketFooter(page,'.auction-arena');await expect(page.getByText(`Pokémon · ${manifest.auctions[index].category==='legacy'?'Legacy':'Modern'} Auctions`,{exact:true})).toBeVisible();
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.daily.save.auction.npcs=state.daily.save.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
  await page.getByLabel('Bid (virtual USD)',{exact:true}).fill('10');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(3500);await expect(page.getByRole('heading',{name:'Auction Settled',exact:true})).toBeVisible();
  const finish=page.getByRole('button',{name:index===4?'Complete Challenge':'Continue Daily Challenge',exact:true});await expect(finish).toBeEnabled();expect((await saved(page)).daily.save.wallet.inventory).toEqual([]);await finish.click();
  if(index===1){await page.reload();await expect(page.getByRole('button',{name:'Enter Auction 3 · Free',exact:true})).toBeVisible()}
 }
 const completed=await saved(page);expect(completed.daily.status).toBe('completed');expect(completed.wallet.cash).toBe(250000+completed.daily.reward);expect(completed.daily.reward).toBeGreaterThan(25000);expect(completed.wallet.inventory).toEqual([]);expect(completed.statistics).toBeUndefined();expect(catalogReads).toHaveLength(0);
 await page.reload();await expect(page.getByText('Challenge Complete',{exact:false})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(completed.wallet.cash);await page.goto(gameSharePath(auctionRunShare(manifest,completed.daily.receipts)));
 await expect(page.getByRole('heading',{name:'Pokémon Daily Auction Results · 2026-11-19',exact:true})).toBeVisible();await expect(page.locator('.game-result-table tbody tr')).toHaveCount(5);await expect(page.locator('button.game-result-card')).toHaveCount(5);await page.locator('button.game-result-card').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();expect(await saved(page)).toEqual(completed);expect(await page.evaluate(key=>localStorage.getItem(key),riftKey)).toBe(rift);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390){const table=page.getByRole('region',{name:'Daily auction breakdown; scroll to view all columns',exact:true});await table.focus();await expect(table).toBeFocused();const before=await table.evaluate(node=>node.scrollLeft);await page.keyboard.press('ArrowRight');await page.clock.runFor(400);await expect.poll(()=>table.evaluate(node=>node.scrollLeft)).toBeGreaterThan(before)}await page.screenshot({path:info.outputPath(`pokemon-daily-results-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
});

test('Pokémon daily unavailable and wrong-market snapshots consume no attempt; expired runs award nothing',async({page})=>{
 const {manifest}=await setup(page);await page.route('**/api/games/pokemon/auction/daily*',route=>route.fulfill({status:503,json:{error:'unavailable'}}));await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();await expect(page.getByRole('alert')).toContainText('attempt has not started');expect(await saved(page)).toBeNull();
 await page.route('**/api/games/pokemon/auction/daily*',route=>route.fulfill({json:{...manifest,market:undefined,version:1}}));await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();expect(await saved(page)).toBeNull();
 await page.route('**/api/games/pokemon/auction/daily*',route=>route.fulfill({json:manifest}));await page.getByRole('button',{name:'Start Daily Challenge',exact:true}).click();await expect(page.getByRole('button',{name:'Enter Auction 1 · Free',exact:true})).toBeVisible();await page.clock.setSystemTime(new Date('2026-11-20T00:00:00Z'));await page.clock.runFor(300);await expect(page.getByRole('button',{name:'Start Daily Challenge',exact:true})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(250000);
});

test('Pokémon auction share rejects a changed catalog identity and the daily tile is discoverable',async({page})=>{
 const {manifest}=await setup(page),receipts=Array.from({length:5},()=>[1,1000,0,0,4,0] as [number,number,number,number,number,number]),share=auctionRunShare(manifest,receipts);if(share.v!==2)throw Error('Expected Pokémon share');await page.goto(gameSharePath({...share,c:'0'.repeat(64)}));await expect(page.getByRole('alert')).toContainText('does not match');expect(await saved(page)).toBeNull();
 await page.goto('/games');await expect(page.getByRole('link',{name:/Pokémon Daily Auction Challenge/})).toHaveAttribute('href','/games/pokemon-auction/daily');
});
