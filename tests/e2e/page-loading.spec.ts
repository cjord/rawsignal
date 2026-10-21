import {expect,test} from '@playwright/test';
import {rolldown} from 'rolldown';
import {resolve} from 'node:path';
let script:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/page-loading-browser.tsx',resolve:{alias:{'next/link':resolve('tests/helpers/account-link.tsx')}},platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});script=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
for(const kind of ['sets','metrics'])test(`${kind}: scoped server body never includes the other market; bare URLs reserve a neutral shell`,async({page},testInfo)=>{
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(s=>Array.from(s.cssRules).map(r=>r.cssText).join('\n')).join('\n'));
 await page.route('**/scope-body**',r=>r.fulfill({contentType:'text/html',body:`<html data-theme="dark"><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 await page.addInitScript(()=>localStorage.setItem('raw-signal-market','riftbound'));
 for(const seeded of [true,false]){
  await page.goto(`/scope-body?kind=${kind}${seeded?'&seed=1&market=riftbound':''}`);await page.addScriptTag({content:script});
  const markup=await page.evaluate(()=>(window as unknown as {scopeServerMarkup:string}).scopeServerMarkup);
  const serverText=await page.evaluate(html=>new DOMParser().parseFromString(html,'text/html').body.textContent??'',markup);
  expect(markup).toContain('class="market-scope-content" disabled=""');
  if(seeded){expect(serverText).not.toContain(kind==='sets'?'Pokémon Sets':'Pokémon singles');expect(serverText).toContain(kind==='sets'?'Riftbound Sets':'Riftbound singles')}
  else{expect(markup).toContain('Loading selected market');expect(serverText).not.toContain(kind==='sets'?'Pokémon Sets':'Pokémon singles')}
  await expect(page.getByRole('tab',{name:'Riftbound',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.market-scope-placeholder')).toHaveCount(0);
  for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`${kind}-${seeded}-${width}-${theme}.png`)})}
 }
});
test('auction backdrop replaces rejected art without shrinking its loops',async({page})=>{
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(s=>Array.from(s.cssRules).map(r=>r.cssText).join('\n')).join('\n'));
 await page.route('**/scope-body**',r=>r.fulfill({contentType:'text/html',body:`<html><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 let release=()=>{};const held=new Promise<void>(done=>{release=done});let rejected='';
 await page.route('https://backdrop.example/**',async route=>{await held;const url=route.request().url();if(!rejected)rejected=url;const bad=url===rejected;await route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${bad?400:200}" height="${bad?570:280}"><rect width="200" height="280" fill="#7557ff"/></svg>`})});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/scope-body?kind=backdrop');await page.addScriptTag({content:script});await expect(page.locator('.auction-entry-art-group img')).toHaveCount(108);
 const widths=()=>page.locator('.auction-entry-art-group').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));const before=await widths();release();await expect(page.locator('.auction-entry-art-group img.is-decoded').first()).toBeVisible();await expect.poll(()=>page.locator(`img[src="${rejected}"]`).count()).toBe(0);const after=await widths();expect(after.map((n,i)=>Math.abs(n-before[i])<.01)).toEqual(Array(6).fill(true));await expect(page.locator('.auction-entry-art-group img')).toHaveCount(108);
});
