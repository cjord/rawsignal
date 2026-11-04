import {expect,test,type Page} from '@playwright/test';
import {rolldown} from 'rolldown';
import {resolve} from 'node:path';
import {emptyArticleDraft,type ArticleRecord} from '../../core/domain/articles';
let script:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/articles-browser.tsx',resolve:{alias:{'next/link':resolve('tests/helpers/account-link.tsx')}},platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});script=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
async function fixture(page:Page,editor=false,queue=false){
 await page.route('**/article-card-art.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="#2672ef"/></svg>'}));
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.route('**/articles-fixture**',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="dark" data-articles-enabled="true"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:true,features:{audit:true},providers:{google:true,discord:true,email:true},user:{id:'editor',name:'Editor',email:'editor@example.test',emailVerified:true,role:'admin'},documents:[]}}));
 await page.goto(`/articles-fixture${queue?'?queue=1':editor?'?editor=1':''}`);await page.addScriptTag({content:script});
}
test('article references load current charts on demand, share lookup state, preserve dated quotes and dismiss with Escape',async({page},info)=>{
 let reads=0;await page.route('**/api/history?**',async route=>{reads++;await route.fulfill({json:{snapshotId:'test:2026-10-27',points:[],coverage:'none',change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null}})});
 await fixture(page);await expect(page.getByRole('heading',{name:'Radiance release outlook'})).toBeVisible();expect(reads).toBe(0);
 expect(await page.evaluate(()=>Reflect.get(window,'articleUnsafe'))).toBeUndefined();await expect(page.getByRole('link',{name:'Unsafe',exact:true})).toHaveCount(0);
 const link=page.getByRole('link',{name:'Ezreal Signature',exact:true}).first();await expect(link).toHaveAttribute('href','/cards/123');await link.focus();await expect(page.getByRole('dialog',{name:'Current card history'})).toBeVisible();await expect.poll(()=>reads).toBe(1);await expect(page.getByText('Current market history · As of 2026-10-27',{exact:true})).toBeVisible();
 await expect(page.getByRole('img',{name:'Ezreal, Dashing',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toContainText('English · Near Mint Foil');
 await page.getByRole('button',{name:'Close card preview'}).focus();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(link).toBeFocused();
 await page.getByRole('link',{name:'Ezreal again'}).hover();await expect(page.getByRole('dialog')).toBeVisible();expect(reads).toBe(1);await page.keyboard.press('Escape');await page.mouse.move(0,0);await expect(page.getByText('$470',{exact:true})).toBeVisible();
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.article-version-history')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await page.screenshot({path:info.outputPath(`article-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
});

test('name-only sealed brackets show artwork and unopened details, then open the exact sealed view',async({page})=>{
 const requests:URL[]=[];await page.route('**/api/history?**',route=>{requests.push(new URL(route.request().url()));return route.fulfill({json:{points:[],coverage:'none'}})});
 await fixture(page);const link=page.getByRole('link',{name:'Radiance Booster Box',exact:true});await expect(link).toHaveAttribute('href','/sealed/456?market=riftbound');
 expect(requests).toHaveLength(0);await link.hover();await expect(page.getByRole('dialog')).toContainText('English · Unopened');await expect(page.getByRole('img',{name:'Radiance Booster Box',exact:true})).toBeVisible();await expect.poll(()=>requests.length).toBe(1);
 expect(requests[0].searchParams.get('sealed')).toBe('1');await expect(page.locator('.article-prose code').filter({hasText:'[[Example only]]'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Already published legacy link'})).toHaveAttribute('href','/cards/123');
 await page.route('**/sealed/456?market=riftbound',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Sealed product details</h1>'}));
 await link.click();await expect(page).toHaveURL(/\/sealed\/456\?market=riftbound$/);await expect(page.getByRole('heading',{name:'Sealed product details'})).toBeVisible();
});

test('editor resolves typed brackets, flags ambiguity, and keeps reference failures from overwriting the draft',async({page})=>{
 let unavailable=false;const requests:URL[]=[];
 await page.route('**/api/articles/products?**',route=>{
  const url=new URL(route.request().url());requests.push(url);
  if(unavailable)return route.fulfill({status:503,json:{error:'Unavailable'}});
  return route.fulfill({json:{products:url.searchParams.getAll('name').includes('Neeko')?[{kind:'single',productId:123,name:'Neeko',set:'Radiance',game:'riftbound',number:'167',printing:'Foil',image:null,marketPrice:7,midPrice:null}]:[]}});
 });
 await fixture(page,true);const input=page.getByLabel('Article text (Markdown)'),preview=page.getByRole('region',{name:'Article preview'});
 await input.fill('[[Neeko]]');await expect(preview.getByRole('link',{name:'Neeko',exact:true})).toHaveAttribute('href','/cards/123');expect(requests[0].searchParams.getAll('name')).toEqual(['Neeko']);
 await input.fill('[[Ambiguous champion]]');await expect(preview.locator('.article-unresolved-reference')).toContainText('[[Ambiguous champion]]');await page.getByText(/Pre-publication checks/).click();await expect(page.getByText(/Resolve \[\[Ambiguous champion\]\]/)).toBeVisible();
 unavailable=true;await input.fill('[[New card]]');await expect(page.getByRole('alert')).toContainText('Product lookup is unavailable');await expect(input).toHaveValue('[[New card]]');await expect(preview.getByRole('link')).toHaveCount(0);
});
test('editor saves manually, preserves a conflicted buffer and explicitly reviews each publication step',async({page},info)=>{
 let saved:ArticleRecord|null=null,conflict=false;const actions:string[]=[];
 await page.route('**/api/account/admin/articles**',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{article:saved,history:{rows:saved?[{revision:saved.revision,createdAt:saved.createdAt}]:[],nextBefore:null}}});
  const body=route.request().postDataJSON();if(conflict)return route.fulfill({status:409,json:{error:'A newer revision exists. Your text has not been overwritten.'}});
  if(body.action){actions.push(body.action);saved={...saved!,state:body.action==='submit'?'needs-review':body.action==='approve'?'approved':'published',publishedRevision:body.action==='publish'?saved!.revision:null}}else saved={id:'article-test',revision:(saved?.revision??0)+1,state:'draft',publishedRevision:null,publishedAt:null,createdAt:'2026-10-27T12:00:00Z',updatedAt:'2026-10-27T12:00:00Z',references:[],draft:{...emptyArticleDraft(),...body.draft}};
  await route.fulfill({json:{article:saved}});
 });
 await fixture(page,true);await expect(page.getByLabel('Public byline')).toHaveValue('Raw Signal Editorial');await page.getByLabel('Title',{exact:true}).fill('Radiance release outlook');await page.getByRole('button',{name:'Use title for URL'}).click();await page.getByLabel('Short summary').fill('A dated release outlook.');await page.getByLabel('Observation time').fill('2026-10-26T12:00');await page.getByLabel('Article text (Markdown)').fill('The release premium should narrow as supply arrives. Estimates depend on availability and demand.');
 await page.getByText('Sources, disclosure & forecast records',{exact:true}).click();await page.getByLabel('Source links').fill('https://example.test/\nhttps://www.tcgplayer.com/');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved revision 1');expect(saved!.draft.sources).toHaveLength(2);
 await page.getByRole('button',{name:'Submit for review'}).click();await expect(page.getByRole('button',{name:'Approve reviewed revision'})).toBeDisabled();await page.getByRole('checkbox',{name:/I reviewed/}).check();await page.getByRole('button',{name:'Approve reviewed revision'}).click();await expect(page.getByRole('button',{name:'Publish article'})).toBeDisabled();await page.getByRole('checkbox',{name:/I reviewed/}).check();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Publish article'}).click();await expect.poll(()=>actions.join(',')).toBe('submit,approve,publish');
 conflict=true;await page.getByLabel('Title',{exact:true}).fill('Keep my unsaved title');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('alert')).toContainText('newer revision');await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Keep my unsaved title');
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`editor-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
});
test('touch readers can inspect then open the exact card, and preview preferences suppress history requests',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();let reads=0;
 try{
  await page.route('**/api/history?**',route=>{reads++;return route.fulfill({status:503,json:{error:'Unavailable'}})});
  await fixture(page);await page.getByRole('link',{name:'Ezreal Signature',exact:true}).first().tap();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('link',{name:'View details →'})).toHaveAttribute('href','/cards/123');await expect.poll(()=>reads).toBe(1);
  await page.getByRole('button',{name:'Close card preview'}).tap();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Display settings'}).tap();await page.getByRole('button',{name:/Off No popups/}).tap();await page.getByRole('button',{name:'Display settings'}).tap();
  await page.getByRole('link',{name:'Ezreal Signature',exact:true}).first().focus();await expect(page.getByRole('dialog')).toHaveCount(0);expect(reads).toBe(1);
  await page.getByText('More',{exact:true}).tap();await expect(page.getByRole('link',{name:'Articles',exact:true}).last()).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('link',{name:'Articles',exact:true}).last()).toBeHidden();
 }finally{await context.close()}
});
test('New Article performs a document navigation from the real queue control',async({page})=>{
 await page.route('**/api/account/admin/articles**',route=>route.fulfill({json:{rows:[],page:1,pages:1,total:0}}));
 await fixture(page,false,true);await expect(page.getByText('No articles yet. Create a draft to begin.')).toBeVisible();
 await page.route('**/admin/articles/new',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Editor destination</title><h1>New article document</h1>'}));
 await page.getByRole('link',{name:'New article',exact:true}).click();await expect(page).toHaveURL(/\/admin\/articles\/new$/);await expect(page.getByRole('heading',{name:'New article document'})).toBeVisible();
});
test('editor product search includes every rarity and inserts exact single and sealed identities',async({page})=>{
 const requests:URL[]=[];
 await page.route('**/api/catalog?**',route=>{
  const url=new URL(route.request().url());requests.push(url);const sealed=url.searchParams.get('mode')==='sealed';
  const items=sealed?[{productId:456,name:'Radiance Booster Box',set:'Radiance',game:'riftbound',image:null}]:url.searchParams.get('rarity')==='all'?[{productId:123,name:'Neeko, Blending In',set:'Radiance',game:'riftbound',number:'167',printing:'Foil',image:null}]:[];
  return route.fulfill({json:{items}});
 });
 await fixture(page,true);await page.getByLabel('Name',{exact:true}).fill('Neeko');expect(requests).toHaveLength(0);await page.getByRole('button',{name:'Search catalog'}).click();await expect(page.getByRole('button',{name:'Insert',exact:true})).toBeVisible();
 expect(requests[0].searchParams.get('rarity')).toBe('all');expect(requests[0].searchParams.get('perPage')).toBe('20');await page.getByRole('button',{name:'Insert',exact:true}).click();await expect(page.getByLabel('Article text (Markdown)')).toHaveValue('[[Neeko, Blending In::single:123]]');
 await page.getByRole('combobox',{name:'Product',exact:true}).selectOption('sealed');await page.getByLabel('Name',{exact:true}).fill('Radiance');await page.getByRole('button',{name:'Search catalog'}).click();await expect(page.getByText('Radiance Booster Box',{exact:true})).toBeVisible();expect(requests[1].searchParams.has('rarity')).toBe(false);await page.getByRole('button',{name:'Insert',exact:true}).click();await expect(page.getByLabel('Article text (Markdown)')).toHaveValue(/\[\[Radiance Booster Box::sealed:456\]\]/);
});
