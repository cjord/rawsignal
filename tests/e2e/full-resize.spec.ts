import {expect,test} from '@playwright/test';
import {rolldown} from 'rolldown';
let script:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/full-resize-browser.tsx',platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});script=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
for(const mode of ['singles','sealed'])for(const theme of ['dark','light'])for(const font of ['default','large'])test(`${mode} Full resize retains bounded rows and reachable chart controls · ${theme} · ${font}`,async({page},testInfo)=>{
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/games');
 const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.route('**/full-resize-fixture**',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="${theme}" data-font-size="${font}"><head><style>${styles}.full-resize-intro{min-height:100px}@media(max-width:759px){.full-resize-intro{min-height:1000px}}</style></head><body><div id="fixture"></div></body></html>`}));
 await page.goto('/full-resize-fixture?mode='+mode);await page.addScriptTag({content:script});await expect(page.locator('.signal-card-wrap')).toHaveCount(12);await page.evaluate(()=>document.fonts.ready);
 // Warm desktop intrinsic sizes, then resize while cards move below the controls.
 for(const width of [1440,390,820,320,1440,390]){
  await page.setViewportSize({width,height:1000});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.signal-card-wrap').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().right<=innerWidth+1))).toBe(true);
 }
 const first=page.locator('.signal-card-wrap').first();await first.scrollIntoViewIfNeeded();const ranges=first.getByRole('group',{name:'Chart range'});await expect(ranges).toBeVisible();
 expect(await ranges.evaluate(node=>{const control=node.getBoundingClientRect(),card=node.closest('article')!.getBoundingClientRect();return control.left>=card.left&&control.right<=card.right+1})).toBe(true);
 if(mode==='sealed')expect(await first.locator('.history-stats b').evaluateAll(nodes=>nodes.every(node=>{const text=document.createRange();text.selectNodeContents(node);const value=text.getBoundingClientRect(),tile=node.parentElement!.getBoundingClientRect();return value.left>=tile.left&&value.right<=tile.right+1}))).toBe(true);
 await ranges.getByRole('button',{name:'7D',exact:true}).click();await expect(ranges.getByRole('button',{name:'7D',exact:true})).toHaveClass('active');
 await expect(first.getByRole('button',{name:/Add .* to favorites/})).toBeVisible();await expect(page.locator('.signal-card-wrap').nth(2)).toContainText('N/A');await first.screenshot({path:testInfo.outputPath('mobile-full.png')});
});
