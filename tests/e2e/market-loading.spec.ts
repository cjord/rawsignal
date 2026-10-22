import {expect,test,type Page} from '@playwright/test';
import {rolldown} from 'rolldown';
import {resolve} from 'node:path';
let script:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/market-loading-browser.tsx',resolve:{alias:{'next/link':resolve('tests/helpers/account-link.tsx')}},platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});script=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
async function fixture(page:Page,query='',user=false){
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.evaluate(()=>localStorage.setItem('raw-signal-market','riftbound'));
 await page.route('**/market-fixture**',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="dark"><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 let release=()=>{};const waiting=new Promise<void>(done=>{release=done});
 await page.route('**/api/account/session',async route=>{await waiting;await route.fulfill({json:{enabled:true,features:{recovery:false,audit:false},providers:{},user:user?{id:'market-owner',name:'Reader',email:'reader@example.test',emailVerified:true}:null,documents:user?[{key:'raw-signal-strictness',value:'aggressive',revision:1,updatedAt:'2026-10-21'}]:[]}})});
 const feeds:string[]=[];page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/data/'))feeds.push(path)});
 await page.goto('/market-fixture'+query);
 await page.evaluate(()=>{const values:string[]=[];Object.assign(window,{marketSelections:values});new MutationObserver(()=>{const selected=document.querySelector('.market-tabs [aria-selected="true"]')?.textContent;if(selected&&values.at(-1)!==selected)values.push(selected)}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-selected']})});
 await page.addScriptTag({content:script});return {release,feeds};
}
for(const view of ['cards','sets','metrics'])test(`${view}: one market selection and one mount despite slow account bootstrap`,async({page},testInfo)=>{
 const {release,feeds}=await fixture(page,'?fixtureView='+view,view==='metrics');
 const tabs=page.locator('.market-tabs');await expect(tabs.getByRole('tab',{name:'Riftbound',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByLabel('Account Phase')).toHaveText('loading');
 // Public market scope is usable before the account request finishes.
 expect(await tabs.evaluate(node=>!!node.closest('[inert]'))).toBe(false);await expect(page.getByRole('button',{name:'Display settings'})).toBeDisabled();
 await expect(page.locator('html')).toHaveAttribute('data-market-mounts','1');
 if(view==='cards')await expect.poll(()=>feeds.filter(path=>path==='/data/overnumbered.json').length).toBe(1);
 const before=[...feeds];release();await expect(page.getByLabel('Account Phase')).toHaveText(view==='metrics'?'market-owner':'guest');await expect(page.locator('html')).toHaveAttribute('data-market-mounts','1');await expect(tabs.getByRole('tab',{name:'Riftbound',exact:true})).toHaveAttribute('aria-selected','true');
 expect(await page.evaluate(()=>(window as unknown as {marketSelections:string[]}).marketSelections)).toEqual(['Riftbound']);expect(feeds).toEqual(before);
 if(view==='metrics')await expect(page.getByLabel('Saved Strictness')).toHaveText('aggressive');
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await tabs.screenshot({path:testInfo.outputPath(`${view}-${width}-${theme}.png`)});}
});
test('explicit market wins; bare URL filters survive; Back restores scope without a second bootstrap',async({page})=>{
 const {release}=await fixture(page,'?market=pokemon&rarity=illustration-rares&q=teemo&view=text');release();await expect(page.getByLabel('Account Phase')).toHaveText('guest');await expect(page.getByRole('tab',{name:'Pokémon',exact:true})).toHaveAttribute('aria-selected','true');await expect(page).toHaveURL(/q=teemo/);await page.getByRole('tab',{name:'Riftbound',exact:true}).click();await expect(page).toHaveURL(/market=riftbound/);await page.goBack();await expect(page.getByRole('tab',{name:'Pokémon',exact:true})).toHaveAttribute('aria-selected','true');await expect(page).toHaveURL(/q=teemo/);await expect(page.locator('html')).toHaveAttribute('data-market-mounts','1');
});
test('sealed shared links do not load singles or lose Scalper mode when account preferences arrive',async({page})=>{
 const {release,feeds}=await fixture(page,'?mode=sealed&market=scalping&view=text&type=Cases&keepPct=75',true);
 await expect(page.getByRole('tab',{name:'Obey Products',exact:true})).toHaveAttribute('aria-selected','true');release();await expect(page.getByLabel('Account Phase')).toHaveText('market-owner');await expect(page.getByRole('tab',{name:'Obey Products',exact:true})).toHaveAttribute('aria-selected','true');await expect(page).toHaveURL(/keepPct=75/);expect(feeds.some(path=>/overnumbered|illustration-rares/.test(path))).toBe(false);await expect(page.locator('html')).toHaveAttribute('data-market-mounts','1');
});

test('Cards header has no false server market and its count/date slots stay fixed on phones',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 let reveal=()=>{};const held=new Promise<void>(done=>reveal=done);
 const rows=Array.from({length:101},(_,i)=>({game:'riftbound',section:'overnumbered',productId:997000+i,name:`Geometry ${i}`,set:'Origins',year:2025,rarity:'Showcase',number:String(i),printing:'Foil',image:'',url:'',marketPrice:10,lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
 await page.route('**/data/overnumbered.json',async route=>{await held;await route.fulfill({json:rows})});
 await page.route('**/data/freshness.json',async route=>{await held;await route.fulfill({json:{sourceUpdatedAt:'2026-10-21T00:00:00Z'}})});
 const {release}=await fixture(page,'?market=riftbound');release();await expect(page.getByRole('tab',{name:'Riftbound',exact:true})).toHaveAttribute('aria-selected','true');
 const server=await page.evaluate(()=>new DOMParser().parseFromString((window as unknown as {marketServerMarkup:string}).marketServerMarkup,'text/html').querySelector('.section-heading')?.textContent);
 expect(server).toContain('Loading market');expect(server).not.toContain('Pokémon');
 await expect(page.locator('.section-heading h2')).toContainText('Overnumbered');
 const before=await page.locator('.controls').boundingBox(),aside=await page.locator('.section-aside').boundingBox();
 reveal();await expect(page.locator('.section-aside')).toContainText('101 cards');await expect(page.locator('.section-aside')).toContainText('Oct 21, 2026');
 const after=await page.locator('.controls').boundingBox(),nextAside=await page.locator('.section-aside').boundingBox();
 expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);expect(Math.abs(nextAside!.x-aside!.x)).toBeLessThan(1);expect(Math.abs(nextAside!.height-aside!.height)).toBeLessThan(1);
});
