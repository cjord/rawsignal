import {expect,test} from '@playwright/test';
import {rolldown} from 'rolldown';
let script:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/card-loading-browser.tsx',platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});script=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
for(const view of ['large','full','sealed-full'])for(const width of [1440,390])test(`${view} reserves card-shaped loading space at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/games');
 const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.route('**/card-loading-fixture**',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="dark"><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 await page.goto(`/card-loading-fixture?view=${view}`);await page.addScriptTag({content:script});
 const loading=page.getByRole('status',{name:'Loading catalog cards'});await expect(loading).toBeVisible();await expect(page.locator('.market-loading-card')).toHaveCount(8);
 const first=await page.locator('.market-loading-card').first().boundingBox(),art=await page.locator('.market-loading-art').first().boundingBox();expect(first!.height).toBeGreaterThan(view==='large'?350:240);expect(art!.height).toBeGreaterThan(140);
 if(view==='large'&&width>=760){const tiles=await page.locator('.market-loading-card').all();expect((await tiles[1].boundingBox())!.x).toBeGreaterThan(first!.x)}
 for(const theme of ['dark','light']){await page.evaluate(t=>{document.documentElement.dataset.theme=t;document.documentElement.dataset.fontSize='large'},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const contrast=await page.locator('.market-loading-art').first().evaluate(node=>{const card=node.closest('.market-loading-card')!;return getComputedStyle(node).backgroundColor!==getComputedStyle(card).backgroundColor});expect(contrast).toBe(true);if(view!=='large')expect(await page.locator('.market-loading-chart').first().evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(200);await page.screenshot({path:testInfo.outputPath(`${theme}.png`)})}
 await page.evaluate(()=>(window as unknown as {revealMarket:()=>void}).revealMarket());await expect(loading).toHaveCount(0);await expect(page.locator('.fixture-result').first()).toContainText('N/A');
 const resolvedArt=await page.locator(view==='large'?'.fixture-result .deferred-image':view==='full'?'.fixture-result .full-art':'.fixture-result .sealed-full-art').first().boundingBox();expect(Math.abs(resolvedArt!.width-art!.width)).toBeLessThan(1);expect(Math.abs(resolvedArt!.height-art!.height)).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('numeric fallback keeps mono widths while web fonts are delayed; primary Latin faces are preloaded',async({page})=>{
 let release=()=>{};const held=new Promise<void>(done=>{release=done});await page.route('**/fonts/**',async route=>{await held;await route.continue()});
 await page.goto('/cards/676093',{waitUntil:'domcontentloaded'});await expect(page.locator('.detail-primary-price')).toBeVisible();
 const preloads=page.locator('head link[rel="preload"][as="font"]');await expect(preloads).toHaveCount(2);expect(await preloads.evaluateAll(nodes=>nodes.every(node=>node.getAttribute('crossorigin')==='anonymous'))).toBe(true);
 const measure=()=>page.evaluate(()=>{const context=document.createElement('canvas').getContext('2d')!;context.font='750 40px "Geist Mono", "Geist Mono Fallback", monospace';return context.measureText('$1,234.56').width});
 const before=await measure();release();await page.evaluate(()=>document.fonts.ready);const after=await measure();expect(Math.abs(before-after)).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
