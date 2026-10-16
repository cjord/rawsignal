import {expect,test} from '@playwright/test';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
import {REBALANCED_INVESTIGATIONS} from '../../core/domain/auction-investigations-v2';
import {AUCTION_LOT_THEMES} from '../../core/domain/auction-lot-themes';

test('Auction Guide is linked from the lobby, documents live configuration and needs no market calls',async({page},testInfo)=>{
 await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:'[]'}));
 await page.goto('/games/riftbound-auction');await page.getByRole('link',{name:'Auction Guide'}).click();
 await expect(page.getByRole('heading',{name:'Auction Guide',exact:true})).toBeVisible();
 let marketCalls=0;page.on('request',request=>{if(/\/(?:api|data)\//.test(new URL(request.url()).pathname))marketCalls++;});
 await page.reload();await expect(page.getByRole('heading',{name:'Auction Guide',exact:true})).toBeVisible();
 expect(marketCalls).toBe(0);await expect(page.locator('.auction-guide-rivals article')).toHaveCount(AUCTION_NPCS.length);await expect(page.locator('.auction-guide-investigations article')).toHaveCount(REBALANCED_INVESTIGATIONS.length);
 await expect(page.locator('.auction-guide-investigations .auction-clue-icon')).toHaveCount(REBALANCED_INVESTIGATIONS.length);await expect(page.locator('.auction-guide-themes [data-collection-theme]')).toHaveCount(AUCTION_LOT_THEMES.length);const colors=await page.locator('.auction-guide-themes h3').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).color));expect(new Set(colors).size).toBe(AUCTION_LOT_THEMES.length);await expect(page.locator('#collections')).toContainText('71–90 cards free');await expect(page.locator('#collections')).toContainText('106–130 paid');
 for(const name of ['The Trust Fund Kid','The Closer']){await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();const image=page.locator('.auction-guide-rival').filter({has:page.getByRole('heading',{name,exact:true})}).locator('img');await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.complete&&element.naturalWidth>0)).toBe(true);}
 await expect(page.locator('#draw-rates')).toContainText('0.01%');await expect(page.locator('#draw-rates')).toContainText('0.02%');await expect(page.locator('#draw-rates')).toContainText('every T1');await expect(page.locator('#investigations')).toContainText('$75 Free / $125 Paid');
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`auction-guide-${width}-${theme}.png`),fullPage:true,animations:'disabled'});
 }
 await page.getByRole('link',{name:'Investigations',exact:true}).click();await expect(page.locator('#investigations')).toBeInViewport();await page.getByRole('link',{name:'Back to Auction House',exact:false}).click();await expect(page.getByRole('heading',{name:'Riftbound Auction House',exact:true})).toBeVisible();
});
