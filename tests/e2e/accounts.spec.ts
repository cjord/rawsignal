import {expect,test} from '@playwright/test';
import {rolldown} from 'rolldown';
import {resolve} from 'node:path';
let fixtureScript:string;
test.beforeAll(async()=>{const bundle=await rolldown({input:'tests/helpers/account-browser.tsx',resolve:{alias:{'next/link':resolve('tests/helpers/account-link.tsx')}},platform:'browser',transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':JSON.stringify('production')}}});fixtureScript=(await bundle.generate({format:'iife'})).output.find(row=>row.type==='chunk')!.code;await bundle.close()});
test('account controls preserve guest saves, isolate cloud data, save preferences and block conflicts',async({page},testInfo)=>{
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.evaluate(()=>{localStorage.setItem('raw-signal-favorites','guest-favorites');localStorage.setItem('raw-signal-auction-house-v1','guest-progress')});
 await page.route('**/account-fixture',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="dark"><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 const writes:Record<string,unknown>[]=[];let signedIn=false,conflict=false;
 await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:true,providers:{google:true,discord:true,email:true},user:signedIn?{id:'owner-a',name:'Player',email:'player@example.test',emailVerified:true}:null,documents:[]}}));
 await page.route('**/api/account/data',async route=>{const body=route.request().postDataJSON();writes.push(body);await route.fulfill(conflict?{status:409,json:{error:'Conflict'}}:{json:{document:{...body,revision:1,updatedAt:'2026-10-19T12:00:00Z'}}})});
 await page.route('**/api/auth/**',route=>route.fulfill({json:{success:true}}));
 await page.goto('/account-fixture');await page.addScriptTag({content:fixtureScript});await expect(page.getByRole('button',{name:'Log In',exact:true})).toBeVisible();await expect(page.getByLabel('Scoped Favorite')).toHaveText('guest-favorites');
 signedIn=true;await page.reload();await page.addScriptTag({content:fixtureScript});await expect(page.getByRole('button',{name:'Log Out',exact:true}).first()).toBeVisible();await expect(page.getByLabel('Scoped Favorite')).toHaveText('none');expect(await page.evaluate(()=>localStorage.getItem('raw-signal-auction-house-v1'))).toBe('guest-progress');
 await page.getByRole('button',{name:'Display settings'}).click();await expect(page.getByRole('menuitem',{name:'Profile & Account'})).toBeVisible();await page.getByRole('button',{name:'Display settings'}).click();await page.getByRole('button',{name:'Cloud Preference',exact:true}).click();await expect.poll(()=>writes.length).toBe(1);expect(writes[0]).toMatchObject({key:'raw-signal-theme',owner:'owner-a',value:'light',revision:0});
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`account-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
 conflict=true;await page.getByRole('button',{name:'Cloud Sound',exact:true}).click();await expect(page.getByRole('alert')).toContainText('another device');await expect(page.getByRole('button',{name:'Export Pending Changes'})).toBeVisible();expect(await page.getByRole('button',{name:'Cloud Preference'}).evaluate(node=>!!node.closest('[inert]'))).toBe(true);
});
