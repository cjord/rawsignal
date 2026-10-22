import {test,expect} from '@playwright/test';
import {initialAuctionSave} from '../../core/domain/auction-types';

const key='raw-signal-auction-house-v1';
const rows=Array.from({length:12},(_,index)=>({game:'riftbound',productId:998000+index,name:`Wallet Card ${index}`,image:'https://wallet-art.example/card.svg',marketPrice:(index+1)*10,printing:'Normal',section:'rares',rarity:'Rare',set:'Origins',year:2025,number:String(index),url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));

test('compact wallet separates card counts and keeps one valuation hint with only a destructive reset control',async({page},testInfo)=>{
 let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({json:rows})});
 await page.route('https://wallet-art.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'}));
 const save=initialAuctionSave();save.wallet.cash=123456;save.wallet.inventory=[{productId:998000,printing:'Normal',quantity:2}];save.showcase=[{productId:998000,printing:'Normal',quantity:1},{productId:998001,printing:'Normal',quantity:1}];
 await page.addInitScript(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save});await page.goto('/games/riftbound-auction');
 const wallet=page.locator('.auction-wallet');await expect(wallet.locator('.auction-cash-value')).toHaveText('$1,234.56');await expect(wallet.locator('.auction-net-worth')).toHaveText('$1,279.56');await expect(wallet.locator('.auction-inventory-value')).toHaveText('$18.00');await expect(wallet.locator('.auction-showcase-value')).toHaveText('$27.00');
 await expect(wallet.locator('details')).toHaveCount(0);await expect(wallet.locator('.auction-wallet-inventory')).toContainText('– 2 Cards');await expect(wallet.locator('.auction-wallet-showcase')).toContainText('– 2 Cards');await expect(wallet.getByRole('link')).toHaveCount(0);await expect(wallet.getByRole('button',{name:'Refresh market',exact:true})).toHaveCount(0);await expect(wallet.locator('.info-hint')).toHaveCount(1);await expect(wallet).toContainText('Total Net Worth');await expect(wallet).toContainText('Showcase Value');
 const reset=wallet.getByRole('button',{name:'Reset cash & inventory',exact:true});await expect(reset).toHaveClass(/game-control-danger/);
 await expect(page.getByRole('link',{name:'Auction Guide',exact:true})).toHaveCSS('background-color',await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).evaluate(node=>getComputedStyle(node).backgroundColor));
 const baseline=requests;
 for(const width of [1440,390,320])for(const theme of ['dark','light']){
  await page.mouse.move(0,0);await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur()});
  await page.setViewportSize({width,height:1100});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.fontSize='large'},theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await wallet.getByRole('button',{name:'Wallet valuation',exact:true}).click();await expect(wallet.getByRole('tooltip')).toContainText('inventory $20.00; showcase $30.00');await expect(wallet.getByRole('tooltip')).toContainText('10% selling fee');await page.keyboard.press('Escape');
  await page.mouse.move(0,0);await page.getByRole('heading',{name:'Available Cash',exact:true}).click();await wallet.screenshot({path:testInfo.outputPath(`wallet-${width}-${theme}.png`),animations:'disabled'});
 }
 const dimensions=await wallet.evaluate(element=>({cash:parseFloat(getComputedStyle(element.querySelector('.auction-cash-value')!).fontSize),net:parseFloat(getComputedStyle(element.querySelector('.auction-net-worth')!).fontSize)}));expect(dimensions.cash).toBeGreaterThan(dimensions.net);
 const origin=await page.evaluate(()=>performance.timeOrigin);await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).click();await expect(page.getByRole('heading',{name:'Auction Inventory',exact:true})).toBeVisible();expect(await page.evaluate(()=>performance.timeOrigin)).toBe(origin);expect(requests).toBe(baseline);
 await page.getByRole('link',{name:'← Auction House',exact:true}).click();await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'My Showcase',exact:true}).click();await expect(page.getByRole('heading',{name:'Auction Showcase',exact:true})).toBeVisible();expect(requests).toBe(baseline);
});

test('unpriced protected holdings make total unavailable without hiding cash or priced inventory',async({page})=>{
 await page.route('**/data/*.json',route=>route.fulfill({json:rows.map((row,index)=>index===1?{...row,marketPrice:null}:row)}));await page.route('https://wallet-art.example/**',route=>route.abort());
 const save=initialAuctionSave();save.wallet.inventory=[{productId:998000,printing:'Normal',quantity:2}];save.showcase=[{productId:998001,printing:'Normal',quantity:1}];
 await page.addInitScript(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save});await page.goto('/games/riftbound-auction');await expect(page.locator('.auction-wallet-coverage')).toContainText('1 unpriced');
 await expect(page.locator('.auction-cash-value')).toHaveText('$2,500.00');await expect(page.locator('.auction-inventory-value')).toHaveText('$18.00');await expect(page.locator('.auction-showcase-value')).toHaveText('N/A');await expect(page.locator('.auction-net-worth')).toHaveText('N/A');await expect(page.locator('.auction-wallet-coverage')).toContainText('Known $2,518.00');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).showcase.length,key)).toBe(1);
});
