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
 await page.route('**/api/auth/**',route=>route.fulfill({json:route.request().url().endsWith('/list-accounts')?[]:{success:true}}));
 await page.goto('/account-fixture');await page.addScriptTag({content:fixtureScript});await expect(page.getByRole('button',{name:'Log In',exact:true})).toBeVisible();await expect(page.getByLabel('Scoped Favorite')).toHaveText('guest-favorites');
 signedIn=true;await page.reload();await page.addScriptTag({content:fixtureScript});await expect(page.getByRole('button',{name:'Log Out',exact:true}).first()).toBeVisible();await expect(page.getByLabel('Scoped Favorite')).toHaveText('none');expect(await page.evaluate(()=>localStorage.getItem('raw-signal-auction-house-v1'))).toBe('guest-progress');
 await page.getByRole('button',{name:'Display settings'}).click();await expect(page.getByRole('menuitem',{name:'Profile & Account'})).toBeVisible();await page.getByRole('button',{name:'Display settings'}).click();await page.getByRole('button',{name:'Cloud Preference',exact:true}).click();await expect.poll(()=>writes.length).toBe(1);expect(writes[0]).toMatchObject({key:'raw-signal-theme',owner:'owner-a',value:'light',revision:0});
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`account-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
 conflict=true;await page.getByRole('button',{name:'Cloud Sound',exact:true}).click();await expect(page.getByRole('alert')).toContainText('another device');await expect(page.getByRole('button',{name:'Export Pending Changes'})).toBeVisible();expect(await page.getByRole('button',{name:'Cloud Preference'}).evaluate(node=>!!node.closest('[inert]'))).toBe(true);
 await expect(page.getByRole('button',{name:'Retry Save'})).toHaveCount(0);await page.getByRole('button',{name:'Load Cloud Save'}).click();await expect(page.getByRole('dialog',{name:'Load the Cloud Save?'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();expect(writes).toHaveLength(2);
});

async function accountFixture(page:import('@playwright/test').Page,{signedIn=false,query=''}={}){
 await page.goto('/games');const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('\n')).join('\n'));
 await page.route('**/account-fixture**',route=>route.fulfill({contentType:'text/html',body:`<html data-theme="dark"><head><style>${styles}</style></head><body><div id="fixture"></div></body></html>`}));
 await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:true,providers:{google:true,discord:true,email:true},user:signedIn?{id:'owner-a',name:'Player',email:'player@example.test',emailVerified:true}:null,documents:[]}}));
 await page.goto('/account-fixture'+query);await page.addScriptTag({content:fixtureScript});
}
test('login recovery explains explicit linking, email controls support resend and immediate correction',async({page},testInfo)=>{
 const requests:{path:string;body:Record<string,unknown>}[]=[];
 await page.route('**/api/auth/**',async route=>{requests.push({path:new URL(route.request().url()).pathname,body:route.request().postDataJSON()});await route.fulfill(route.request().url().endsWith('/sign-in/email-otp')?{status:400,json:{code:'INVALID_OTP',message:'private internal details'}}:{json:{success:true}})});
 await accountFixture(page,{query:'?error=account_not_linked'});
 await expect(page.getByRole('heading',{name:'Connect This Sign-In Method'})).toBeVisible();await expect(page.getByText('Matching email addresses alone',{exact:false})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Sign In with Email Code'})).toHaveAttribute('href','/account?method=email&link=1');
 await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Log In with an Email Account'}).click();
 await page.getByLabel('Email',{exact:true}).fill('PLAYER@example.test');await page.getByRole('button',{name:'Email Me a Code',exact:true}).click();
 await expect(page.getByLabel('Sign-In Code')).toBeFocused();await expect(page.getByRole('button',{name:/Resend Code \(/})).toBeDisabled();
 expect(requests).toHaveLength(1);expect(requests[0].body).toEqual({email:'player@example.test',type:'sign-in'});
 await page.getByLabel('Sign-In Code').evaluate(node=>{const data=new DataTransfer();data.setData('text','123 456');node.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))});await expect(page.getByLabel('Sign-In Code')).toHaveValue('123456');await page.getByRole('button',{name:'Verify Code'}).click();
 await expect(page.getByRole('alert')).toContainText('newest email');await expect(page.getByText('private internal details')).toHaveCount(0);
 await page.getByRole('button',{name:'Change Email'}).click();await expect(page.getByLabel('Email',{exact:true})).toBeEnabled();await expect(page.getByLabel('Sign-In Code')).toHaveCount(0);expect(requests).toHaveLength(2);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1100});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.scrollTo({top:0,behavior:'instant'})},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`login-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
});
test('connected sign-ins are accurate, profile saves in place and device logout requires confirmation',async({page},testInfo)=>{
 const actions:string[]=[];let listCalls=0;
 await page.route('**/api/auth/**',async route=>{const path=new URL(route.request().url()).pathname;actions.push(path);if(path.endsWith('/list-accounts')){listCalls++;await route.fulfill({json:[{id:'provider-account',providerId:'google'}]})}else await route.fulfill({json:{status:true}})});
 await accountFixture(page,{signedIn:true});await expect(page.getByRole('button',{name:'Link Discord'})).toBeEnabled();await expect(page.getByRole('button',{name:'Link Google'})).toHaveCount(0);await expect(page.getByText('Connected',{exact:true})).toBeVisible();
 await page.getByLabel('Display Name').fill('  New Player  ');await page.getByRole('button',{name:'Save Profile'}).click();await expect(page.getByRole('status').filter({hasText:'Profile saved.'})).toBeVisible();await expect(page.getByLabel('Account Name')).toHaveText('New Player');expect(listCalls).toBe(1);
 await page.getByRole('button',{name:'Log Out Other Devices',exact:true}).click();await expect(page.getByRole('dialog',{name:'Log Out Other Devices?'})).toBeVisible();expect(actions.some(path=>path.endsWith('/revoke-other-sessions'))).toBe(false);
 await page.getByRole('button',{name:'Confirm Log Out Other Devices'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(actions.filter(path=>path.endsWith('/revoke-other-sessions'))).toHaveLength(1);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1100});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.scrollTo({top:0,behavior:'instant'})},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`profile-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
});
test('email resend follows its cooldown and server retry-after without sending automatically',async({page})=>{
 await page.clock.install();let sends=0;
 await page.route('**/api/auth/**',async route=>{sends++;await route.fulfill(sends===2?{status:429,headers:{'Retry-After':'120'},json:{code:'RATE_LIMITED'}}:{json:{success:true}})});
 await accountFixture(page,{query:'?method=email&link=1'});await expect(page.getByLabel('Email',{exact:true})).toBeFocused();await page.getByLabel('Email',{exact:true}).fill('player@example.test');await page.getByRole('button',{name:'Email Me a Code',exact:true}).click();
 await expect(page.getByRole('button',{name:/Resend Code \(30s\)/})).toBeDisabled();await page.clock.fastForward(31000);await expect(page.getByRole('button',{name:'Resend Code',exact:true})).toBeEnabled();expect(sends).toBe(1);
 await page.getByRole('button',{name:'Resend Code',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Too many requests');await expect(page.getByRole('button',{name:/Resend Code \(/})).toBeDisabled();
 await page.clock.fastForward(61000);await expect(page.getByRole('button',{name:/Resend Code \(/})).toBeDisabled();await page.clock.fastForward(61000);await expect(page.getByRole('button',{name:'Resend Code',exact:true})).toBeEnabled();expect(sends).toBe(2);
 await page.clock.fastForward(180000);await expect(page.getByText('This code has expired. Request a new code.')).toBeVisible();expect(sends).toBe(2);
});
test('provider-list failures are recoverable and never guess connected status',async({page})=>{
 let calls=0;await page.route('**/api/auth/list-accounts',route=>route.fulfill(++calls===1?{status:503,json:{message:'internal error'}}:{json:[{providerId:'discord'}]}));await accountFixture(page,{signedIn:true});
 await expect(page.getByRole('button',{name:'Link Google'})).toBeDisabled();await expect(page.getByText('Connected',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Retry Sign-In Methods'}).click();await expect(page.getByRole('button',{name:'Link Google'})).toBeEnabled();await expect(page.getByRole('button',{name:'Link Discord'})).toHaveCount(0);expect(calls).toBe(2);
});
test('login stays stacked, email is collapsed, privacy is a tooltip and appearance lives in Settings',async({page})=>{
 await accountFixture(page);await expect(page.getByText('Account saves up to date')).toHaveCount(0);await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
 const providers=page.locator('.account-provider-buttons>button');await expect(providers).toHaveText(['Log In with Discord','Log In with Google','Log In with an Email Account']);await expect(providers.locator('svg')).toHaveCount(3);
 const boxes=await providers.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));expect(boxes[0]).toBeLessThan(boxes[1]);expect(boxes[1]).toBeLessThan(boxes[2]);
 await expect(page.getByRole('button',{name:'Log In',exact:true})).toHaveClass(/account-primary/);await page.getByRole('button',{name:'About account sign-in'}).click();await expect(page.getByRole('tooltip').filter({hasText:'No passwords.'})).toBeVisible();
 await page.setViewportSize({width:390,height:568});await expect(page.getByRole('button',{name:/Switch to light mode/})).toHaveCount(0);await page.getByRole('button',{name:'Display settings'}).click();const menu=await page.getByRole('menu',{name:'Display settings'}).boundingBox();expect(menu!.y+menu!.height).toBeLessThanOrEqual(568);await page.getByRole('button',{name:'Switch to light mode'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
test('device controls load on demand, identify this device and confirm targeted logout',async({page})=>{
 await page.route('**/api/auth/list-accounts',route=>route.fulfill({json:[]}));let reads=0,removed='';
 await page.route('**/api/account/devices**',route=>{if(route.request().method()==='DELETE'){removed=new URL(route.request().url()).searchParams.get('id')??'';return route.fulfill({json:{success:true}})}reads++;return route.fulfill({json:{devices:[{id:'current',current:true,userAgent:'Windows Chrome/100',createdAt:'2026-10-19T00:00:00Z'},{id:'other',current:false,userAgent:'iPhone Safari/100',createdAt:'2026-10-18T00:00:00Z'}]}})});
 await accountFixture(page,{signedIn:true});await expect(page.getByRole('button',{name:'View Signed-In Devices'})).toBeVisible();expect(reads).toBe(0);await page.getByRole('button',{name:'View Signed-In Devices'}).click();await expect(page.getByText('This Device',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Log Out Device',exact:true}).click();expect(removed).toBe('');await page.getByRole('button',{name:'Confirm Device Logout'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(removed).toBe('other');await expect(page.getByRole('button',{name:'Log Out Device',exact:true})).toHaveCount(0);
});
