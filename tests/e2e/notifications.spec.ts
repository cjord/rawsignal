import {expect,test} from '@playwright/test';
import {rolldown} from 'rolldown';
import {initialAuctionSave} from '../../core/domain/auction-types';
let script:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/notification-browser.tsx',platform:'browser',transform:{jsx:'react-jsx'}});script=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
test('bottom-right notifications never shift content, pause on interaction and respect duration settings',async({page},testInfo)=>{
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.route('**/notification-fixture',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="dark"><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 await page.goto('/notification-fixture');await page.addScriptTag({content:script});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
 const title=page.getByRole('heading'),before=await title.boundingBox(),notice=page.getByRole('region',{name:'Notification',exact:true});
 await page.getByLabel('Notification Duration').selectOption('4');await page.getByRole('button',{name:'Notify',exact:true}).click();await expect(notice).toBeVisible();expect(await title.boundingBox()).toEqual(before);
 const box=await notice.boundingBox();expect(box!.x+box!.width).toBeGreaterThan(1200);await page.mouse.move(box!.x+30,box!.y+30);await page.clock.runFor(5000);await expect(notice).toBeVisible();await page.mouse.move(0,0);await page.clock.runFor(4100);await expect(notice).toHaveCount(0);
 await page.getByLabel('Notification Duration').selectOption('0');await page.getByRole('button',{name:'Notify',exact:true}).click();await page.clock.runFor(60000);await expect(notice).toBeVisible();await page.getByRole('button',{name:'Dismiss Notification'}).click();await expect(notice).toHaveCount(0);
 const state={...initialAuctionSave(),revision:2};await page.evaluate(state=>dispatchEvent(new StorageEvent('storage',{key:'raw-signal-auction-house-v1',newValue:JSON.stringify(state)})),state);await expect(notice).toContainText('Game updated in another tab');await expect(page.getByRole('alert')).toHaveCount(0);expect(await title.boundingBox()).toEqual(before);
 await page.evaluate(()=>{const action=document.createElement('button');action.textContent='Underlying Action';action.style.cssText='position:fixed;bottom:16px;right:80px;width:250px;height:60px';action.onclick=()=>{document.documentElement.dataset.underlyingAction='clicked'};document.body.append(action)});await page.getByRole('button',{name:'Underlying Action'}).click();await expect(page.locator('html')).toHaveAttribute('data-underlying-action','clicked');await page.getByRole('button',{name:'Underlying Action'}).evaluate(node=>node.remove());
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`notification-${width}-${theme}.png`),animations:'disabled'})}
 await page.emulateMedia({reducedMotion:'reduce'});await expect(notice).toHaveCSS('animation-name','none');
});
