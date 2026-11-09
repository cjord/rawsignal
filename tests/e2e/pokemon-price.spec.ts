import {test,expect,type Page} from '@playwright/test';
import {rolldown} from 'rolldown';
import {resolve} from 'node:path';
import {createGameCatalogSnapshot} from '../../core/domain/game-catalog-snapshot';
import {initialPriceGame} from '../../core/domain/price-game';
import type {Card} from '../../core/domain/types';
const cards:Card[]=Array.from({length:9},(_,i)=>({game:'pokemon',productId:960001+i,name:'Pokémon Card '+(i+1),image:'https://tcgplayer-cdn.tcgplayer.com/product/'+(960001+i)+'_in_1000x1000.jpg',set:i<3?'SV01: Test Set':i<6?'SWSH01: Test Set':'Base Set',year:i<3?2023:i<6?2020:1999,number:(i+1)+'/100',printing:'Holofoil',rarity:'Common',section:i<6?'pokemon-commons':'vintage',marketPrice:(i+1)*10,lowPrice:null,midPrice:null,highPrice:null,priceChange:null,url:''}));
const metadata={market:'pokemon',source:'database',asOf:'2026-11-09',publishedAt:'2026-11-09T12:00:00Z',bulkReady:true,sets:[{name:'SV01: Test Set',era:'sv',count:3},{name:'SWSH01: Test Set',era:'swsh',count:3},{name:'Base Set',era:'wotc',count:3}]};
async function catalog(page:Page){
 const reads:string[]=[];
 await page.route('https://tcgplayer-cdn.tcgplayer.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#2672ef"/></svg>'}));
 await page.route('**/api/games/pokemon/catalog?**',async route=>{
  const url=new URL(route.request().url());reads.push(url.search);
  if(url.searchParams.get('view')==='scopes')return route.fulfill({json:metadata});
  const scope={market:'pokemon' as const,eras:JSON.parse(url.searchParams.get('eras')??'[]'),sets:JSON.parse(url.searchParams.get('sets')??'[]')};
  return route.fulfill({json:await createGameCatalogSnapshot(cards,scope,'database','2026-11-09','2026-11-09T12:00:00Z')});
 });return reads;
}
let fixtureScript:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/pokemon-price-browser.tsx',resolve:{alias:{'next/link':resolve('tests/helpers/account-link.tsx')}},platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});fixtureScript=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});

test('Pokémon practice starts with chosen sets, shows printing without prices and adds no pricing reads between rounds',async({page})=>{
 const reads=await catalog(page);await page.goto('/games');await page.getByRole('link',{name:/Pokémon Price Showdown/}).click();await expect(page).toHaveTitle('Pokémon Price Showdown | Raw Signal');
 await expect(page.getByText('6 eligible priced cards · English raw singles',{exact:true})).toBeVisible();await expect(page.locator('.price-game-choice')).toHaveCount(0);expect(reads).toHaveLength(1);
 await page.getByText('Choose Specific Sets (Optional)',{exact:true}).click();await page.getByLabel('Search Pokémon sets').fill('SV01');await page.getByRole('checkbox',{name:'SV01: Test Set · 3 cards',exact:true}).check();
 await page.getByRole('button',{name:'Start Showdown',exact:true}).click();const choices=page.locator('.price-game-choice');await expect(choices).toHaveCount(2);await expect(choices.first()).toHaveAttribute('aria-disabled','false');await expect(page.locator('.price-game-printing')).toHaveText(['SV01: Test Set · Holofoil','SV01: Test Set · Holofoil']);await expect(page.locator('.price-game-reveal')).toHaveText(['','']);expect(reads).toHaveLength(2);
 await page.getByLabel('Auto next round (1s)').uncheck();const names=await choices.locator('.price-game-name').allTextContents();const winner=names.indexOf([...names].sort((a,b)=>Number(b.match(/(\d+)$/)![1])-Number(a.match(/(\d+)$/)![1]))[0]);await choices.nth(winner).click();await expect(page.locator('.price-game-score dd')).toHaveText(['1','1','1']);
 await page.getByRole('button',{name:'Next round'}).click();await expect(page.locator('.price-game-score dd')).toHaveText(['1','1','2']);await page.getByRole('tab',{name:'Hard · 3 cards'}).click();await expect(choices).toHaveCount(3);expect(reads).toHaveLength(2);expect(await page.evaluate(()=>localStorage.getItem('raw-signal-pokemon-showdown-practice-v1'))).toBeNull();
});

test('incompatible era/set selections disable entry until corrected instead of broadening the pool',async({page})=>{
 const reads=await catalog(page);await page.goto('/games/pokemon-price');await expect(page.getByRole('button',{name:'Start Showdown',exact:true})).toBeEnabled();await page.getByText('Choose Specific Sets (Optional)',{exact:true}).click();await page.getByRole('checkbox',{name:'SV01: Test Set · 3 cards',exact:true}).check();await page.getByRole('button',{name:'All Eras',exact:true}).click();await page.getByRole('checkbox',{name:'WotC (1999–2003)',exact:true}).check();
 await expect(page.getByRole('alert')).toContainText('SV01: Test Set');await expect(page.getByRole('button',{name:'Start Showdown',exact:true})).toBeDisabled();expect(reads).toHaveLength(1);await page.getByRole('button',{name:'Clear Unavailable Sets',exact:true}).click();await page.getByRole('button',{name:'Start Showdown',exact:true}).click();await expect(page.locator('.price-game-printing')).toHaveText(['Base Set · Holofoil','Base Set · Holofoil']);
});

test('Pokémon pool setup and three-card play stay usable in both themes, widths and reduced motion',async({page},info)=>{
 await catalog(page);
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.goto('/games');await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const tile=page.locator('a.game-tile[href="/games/pokemon-price"]');await tile.scrollIntoViewIfNeeded();await expect(tile.locator('img')).toHaveCount(1);const image=tile.locator('img');await expect(image).toHaveAttribute('src','/images/games/pokemon-price-showdown-v1.webp');await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(1200);const art=(await tile.locator('.game-tile-art').boundingBox())!,box=(await image.boundingBox())!;expect(Math.abs(art.width/art.height-1.5)).toBeLessThan(.01);expect(box.x).toBeGreaterThanOrEqual(art.x);expect(box.y+box.height).toBeLessThanOrEqual(art.y+art.height+1);await tile.screenshot({path:info.outputPath('games-tile-'+width+'-'+theme+'.png'),animations:'disabled'});
  await page.setViewportSize({width,height:1000});await page.goto('/games/pokemon-price');await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await expect(page.getByRole('button',{name:'Start Showdown',exact:true})).toBeEnabled();await page.screenshot({path:info.outputPath('pool-'+width+'-'+theme+'.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Start Showdown',exact:true}).click();await page.getByRole('tab',{name:'Hard · 3 cards'}).click();await expect(page.locator('.price-game-choice')).toHaveCount(3);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.price-game-choice').first()).toHaveAttribute('aria-disabled','false');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('round-'+width+'-'+theme+'.png'),fullPage:true,animations:'disabled'});
 }
});

test('account practice saves stay in the Pokémon namespace, resume the same pool and never adopt guest or Riftbound progress',async({page})=>{
 await catalog(page);await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.route('**/pokemon-fixture',route=>route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div id="fixture"></div></body></html>'}));
 const legacy=JSON.stringify({v:1,difficulty:'normal',state:initialPriceGame([])}),docs=new Map<string,{key:string;value:string;revision:number;updatedAt:string}>([['raw-signal-showdown-practice-v1',{key:'raw-signal-showdown-practice-v1',value:legacy,revision:1,updatedAt:'2026-11-09T12:00:00Z'}]]),writes:Record<string,unknown>[]=[];
 await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:true,features:{recovery:false,audit:false},providers:{google:true,discord:true,email:true},user:{id:'pokemon-owner',name:'Trainer',email:'trainer@example.test',emailVerified:true,role:'member'},documents:[...docs.values()]}}));
 await page.route('**/api/account/data',route=>{const body=route.request().postDataJSON();writes.push(body);const document={key:body.key,value:body.value,revision:body.revision+1,updatedAt:'2026-11-09T12:00:00Z'};docs.set(body.key,document);return route.fulfill({json:{document}})});
 await page.addInitScript(()=>{localStorage.setItem('raw-signal-pokemon-showdown-practice-v1','guest-progress');localStorage.setItem('raw-signal-showdown-difficulty','normal')});
 await page.goto('/pokemon-fixture');await page.addScriptTag({content:fixtureScript});await expect(page.getByRole('button',{name:'Start Showdown',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Start Showdown',exact:true}).click();await expect(page.locator('.price-game-choice').first()).toHaveAttribute('aria-disabled','false');await page.getByLabel('Auto next round (1s)').uncheck();
 await page.locator('.price-game-choice').first().click();await expect(page.locator('.price-game-next')).toContainText('1 answered');await expect.poll(()=>{const row=docs.get('raw-signal-pokemon-showdown-practice-v1');return row?JSON.parse(row.value).state.attempts:0}).toBe(1);
 expect(writes.filter(w=>w.key==='raw-signal-showdown-practice-v1')).toHaveLength(0);expect(docs.get('raw-signal-showdown-practice-v1')!.value).toBe(legacy);expect(await page.evaluate(()=>localStorage.getItem('raw-signal-pokemon-showdown-practice-v1'))).toBe('guest-progress');
 await page.reload();await page.addScriptTag({content:fixtureScript});await page.getByRole('button',{name:'Start Showdown',exact:true}).click();await expect(page.locator('.price-game-next')).toContainText('1 answered');
 await page.getByRole('button',{name:'Change Card Pool',exact:true}).click();await page.getByRole('button',{name:'All Eras',exact:true}).click();await page.getByRole('checkbox',{name:'WotC (1999–2003)',exact:true}).check();await page.getByRole('button',{name:'Start Showdown',exact:true}).click();await expect(page.locator('.price-game-score dd')).toHaveText(['0','0','1']);
 await expect.poll(()=>{const row=docs.get('raw-signal-pokemon-showdown-practice-v1');return row?JSON.parse(row.value).scope.eras:null}).toEqual(['wotc']);await page.reload();await page.addScriptTag({content:fixtureScript});await expect(page.getByRole('button',{name:'Start Showdown',exact:true})).toBeEnabled();await expect(page.getByRole('checkbox',{name:'WotC (1999–2003)',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Scarlet & Violet (2023–2025)',exact:true})).not.toBeChecked();
});

test('pool availability loads in place without moving the start control on desktop or mobile',async({page})=>{
 for(const width of [1440,390])for(const bulkReady of [true,false]){
  await page.setViewportSize({width,height:1000});let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});
  await page.route('**/api/games/pokemon/catalog?view=scopes',async route=>{await pending;await route.fulfill({json:{...metadata,bulkReady,asOf:'2026-11-09T12:00:00.000Z'}})});
  await page.goto('/games/pokemon-price');const start=page.getByRole('button',{name:'Start Showdown',exact:true});await expect(start).toBeDisabled();await expect(page.getByText('Checking market snapshot…',{exact:true})).toBeVisible();const before=await start.boundingBox();release();await expect(start).toBeEnabled();const after=await start.boundingBox();expect(Math.abs(after!.y-before!.y)).toBeLessThanOrEqual(2);await page.unroute('**/api/games/pokemon/catalog?view=scopes');
 }
});
