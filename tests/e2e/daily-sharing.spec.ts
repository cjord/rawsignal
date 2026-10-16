import {expect,test,type Page} from '@playwright/test';
import {createDailyShowdownManifest,initialDailyShowdown,SHOWDOWN_DAILY_KEY} from '../../core/domain/showdown-daily';
import {createDailyAuctionManifest} from '../../core/domain/auction-daily';
import {initialAuctionSave,type DailyAuctionReceipt} from '../../core/domain/auction-types';
import {gameSharePath} from '../../core/domain/game-sharing';

const catalog=Array.from({length:150},(_,index)=>({productId:960000+index,printing:'Normal',name:`Daily Card ${index}`,image:`https://images.example/daily/${index}.svg`,set:'Origins',rarity:index%2?'Epic':'Rare',section:index%2?'epics':'rares',cents:1000+index*137}));
const manifest=createDailyShowdownManifest(catalog,'2026-10-16','test'),auction=createDailyAuctionManifest(catalog,'2026-10-16','test');
async function setup(page:Page){
 await page.clock.install({time:new Date('2026-10-16T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as unknown as {sharedText:string}).sharedText=text}},configurable:true}));
 await page.route('**/api/showdown/daily*',route=>route.fulfill({json:manifest}));await page.route('**/api/auction/daily*',route=>route.fulfill({json:auction}));await page.route('**/data/*.json',route=>route.fulfill({json:[]}));
 await page.route('https://images.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
}
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SHOWDOWN_DAILY_KEY);
test('daily tiles lead to fixed ten-round modes, independent reloadable progress, emoji sharing and a non-mutating results page',async({page},testInfo)=>{
 await setup(page);let calls=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/showdown/daily')calls++});
 await page.goto('/games');await expect(page.getByRole('link',{name:/Daily Auction Challenge/})).toBeVisible();await page.getByRole('link',{name:/Daily Price Showdown/}).click();
 const choices=page.locator('.price-game-choice');await expect(choices).toHaveCount(2);await expect(choices.first()).toHaveAttribute('aria-disabled','false');await page.getByLabel('Auto Next Round (1s)',{exact:true}).uncheck();
 await page.getByRole('tab',{name:'Hard · 3 Cards',exact:true}).click();await expect(choices).toHaveCount(3);await expect(choices.first()).toHaveAttribute('aria-disabled','false');await choices.first().click();expect((await saved(page)).hard.picks).toHaveLength(1);
 await page.getByRole('tab',{name:'Normal · 2 Cards',exact:true}).click();await expect(choices).toHaveCount(2);expect((await saved(page)).normal.picks).toHaveLength(0);
 for(let index=0;index<10;index++){
  await expect(choices.first()).toHaveAttribute('aria-disabled','false');await expect(page.locator('.price-game-reveal')).toHaveText(['','']);
  const round=manifest.normal[index],winner=round.findIndex(card=>card.marketPrice===Math.max(...round.map(card=>card.marketPrice))),pick=index%2?1-winner:winner;
  await choices.nth(pick).click();expect((await saved(page)).normal.picks).toHaveLength(index+1);await choices.nth(1-pick).click({force:true});expect((await saved(page)).normal.picks).toHaveLength(index+1);
  if(index<9)await page.getByRole('button',{name:'Next Round →',exact:true}).click();
  if(index===2){await page.reload();await expect(choices).toHaveCount(2);await page.getByLabel('Auto Next Round (1s)',{exact:true}).uncheck();expect((await saved(page)).normal.cursor).toBe(3)}
 }
 await expect(page.getByRole('heading',{name:'Daily Challenge Complete',exact:true})).toBeVisible();await expect(page.locator('.daily-game-complete')).toContainText('5/10 correct');expect(calls).toBe(1);
 await page.getByRole('button',{name:'Share Results',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Share Your Daily Results',exact:true});await expect(dialog).toBeVisible();const preview=dialog.getByRole('textbox',{name:'Discord / Social Preview'});await expect(preview).toHaveValue(/Normal · 5\/10/);expect((await preview.inputValue()).match(/🟩|🟥/gu)).toHaveLength(10);expect(await preview.inputValue()).not.toContain('Daily Card');await dialog.getByRole('button',{name:'Copy Results',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Copied to clipboard.');
 const url=(await preview.inputValue()).split('\n').at(-1)!;await dialog.getByRole('button',{name:'Close',exact:true}).click();const before=await saved(page);await page.goto(url);await expect(page.getByRole('heading',{name:'Challenge Results',exact:true})).toBeVisible();await expect(page.locator('.game-result-emoji span')).toHaveCount(10);expect(await saved(page)).toEqual(before);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`showdown-results-${width}-${theme}.png`),fullPage:true});}
 await page.goto('/games/riftbound-price/daily');await expect(page.getByRole('heading',{name:'Daily Challenge Complete',exact:true})).toBeVisible();await page.getByRole('tab',{name:'Hard · 3 Cards',exact:true}).click();expect((await saved(page)).hard.picks).toHaveLength(1);await expect(choices).toHaveCount(3);await expect(choices.first()).toHaveAttribute('aria-disabled','true');
});
test('auction sharing reconstructs detailed fees, all five outcomes and top cards without touching a wallet',async({page},testInfo)=>{
 await setup(page);const receipts:DailyAuctionReceipt[]=[[0,1000,800,0,1,1],[1,2000,400,0,3,1],[0,5000,600,0,4,0],[2,8000,2500,300,2,1],[0,3000,0,0,4,0]];
 const normal=initialAuctionSave();await page.goto('/games');await page.evaluate(({key,normal})=>localStorage.setItem(key,JSON.stringify(normal)),{key:'raw-signal-auction-house-v1',normal});
 await page.goto(gameSharePath({v:1,g:'auction',d:'2026-10-16',r:receipts}));await expect(page.getByRole('heading',{name:'Most Valuable Cards Won',exact:true})).toBeVisible();await expect(page.locator('.game-result-table tbody tr')).toHaveCount(5);await expect(page.locator('.game-result-card')).toHaveCount(5);await expect(page.locator('.auction-statistics-grid')).toContainText('3 / 5');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!), 'raw-signal-auction-house-v1')).toEqual(normal);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`auction-results-${width}-${theme}.png`),fullPage:true});}
 await page.getByRole('button',{name:'Share Results',exact:true}).click();await expect(page.getByRole('textbox')).toHaveValue(/3\/5 won/);
});
test('invalid/absent share snapshots fail safely; expired daily Showdown blocks new answers',async({page})=>{
 await setup(page);await page.goto('/games/results#invalid!');await expect(page.getByRole('alert')).toContainText('Invalid results link');
 const state=initialDailyShowdown(manifest);await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:SHOWDOWN_DAILY_KEY,state});await page.goto('/games/riftbound-price/daily');await expect(page.locator('.price-game-choice').first()).toHaveAttribute('aria-disabled','false');await page.clock.setSystemTime(new Date('2026-10-17T00:00:00Z'));await page.clock.runFor(1100);await expect(page.getByRole('button',{name:'Load Today’s Challenge',exact:true})).toBeVisible();await expect(page.locator('.price-game-choice').first()).toHaveAttribute('aria-disabled','true');
 await page.route('**/api/showdown/daily*',route=>route.fulfill({status:404,json:{error:'missing'}}));await page.goto(gameSharePath({v:1,g:'showdown',d:manifest.date,m:'normal',p:Array(10).fill(0)}));await expect(page.getByRole('alert')).toContainText('snapshot is unavailable');
});
