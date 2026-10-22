import {expect,test,type Page} from '@playwright/test';
import {INVESTIGATIONS,RETIRED_INVESTIGATION_IDS} from '../../core/domain/auction-information';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
import {rankAuctionBids,auctionPlacementLabel} from '../../core/domain/auction-ranking';
import {initialAuctionSave} from '../../core/domain/auction-types';
import {investigationDescription} from '../../core/domain/auction-investigations-v4';
test.use({hasTouch:true});

const key='raw-signal-auction-house-v1';
const rows=Array.from({length:26},(_,index)=>({game:'riftbound',productId:970000+index,name:`Auction Card ${index+1}`,image:`https://images.example/auction/${index}.svg`,marketPrice:index+1,printing:'Normal',section:'rares',set:'Origins',year:2025,number:String(index),rarity:index<12?'Common':'Rare',url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
async function fixtures(page:Page){
 await page.addInitScript(()=>Object.defineProperty(crypto,'getRandomValues',{value:(array:Uint32Array)=>{array[0]=42;return array}}));
 await page.route('https://images.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
 await page.clock.install({time:new Date('2026-10-14T12:00:00Z')});
}
const saved=async(page:Page)=>(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key))??initialAuctionSave();
async function startAuction(page:Page,paid=false,skip=true){
 await page.getByRole('button',{name:paid?'Enter Piltover Auction House · $50 Fee':'Enter Bilgewater Auction House',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Your Next Auction',exact:true})).toBeVisible();
 if(skip)await page.getByRole('button',{name:'Skip Intro',exact:true}).click();
}

test('seven-second entry briefing holds the locked table for review, cancels without charges and starts the timer afterward',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');
 const initial=await saved(page);await startAuction(page,true,false);await page.clock.runFor(1000);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect((await saved(page)).wallet).toEqual(initial.wallet);expect((await saved(page)).auction).toBeNull();const pending=(await saved(page)).drafts.paid;
 await page.reload();await startAuction(page,true,false);await page.clock.runFor(4000);const dialog=page.getByRole('dialog',{name:'Your Next Auction',exact:true});await expect(dialog).toBeVisible();expect((await saved(page)).wallet.cash).toBe(250000);expect((await saved(page)).auction).toBeNull();expect((await saved(page)).drafts.paid.seed).toBe(pending.seed);if(pending.lot)expect((await saved(page)).drafts.paid.lot).toEqual(pending.lot);
 const selectedTheme=await dialog.locator('.auction-entry-theme strong').textContent(),opponents=await dialog.locator('.auction-entry-rivals .auction-bidder').allTextContents();
 await expect(dialog.locator('.auction-entry-rivals>.is-locked')).toHaveCount(3);await expect(dialog.getByRole('status')).toContainText('Your table is ready');await page.clock.runFor(2000);expect((await saved(page)).auction).toBeNull();expect((await saved(page)).wallet.cash).toBe(250000);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`entry-briefing-${width}-${theme}.png`),animations:'disabled'});}
 await page.clock.runFor(1100);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();const entered=await saved(page);expect(entered.wallet.cash).toBe(245000);expect(entered.auction.npcs.map((npc:{name:string})=>npc.name)).toEqual(opponents);await expect(page.locator('.auction-collection-heading h2')).toContainText(selectedTheme!);expect(entered.auction.deadline-Date.parse('2026-10-14T12:00:05Z')).toBeGreaterThanOrEqual(65000);
 await expect(page.locator('.auction-lobby-backdrop')).toHaveCount(1);await expect(page.locator('.auction-offer-group,.auction-disclosure')).toHaveCount(0);await expect(page.locator('.auction-offers h3')).toHaveCount(0);await expect(page.locator('.auction-offers [data-investigation]')).toHaveCount(3);
});

test('skipping an intro never bypasses artwork validation and reduced motion disables the drifting backdrop',async({page})=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);await page.route('https://images.example/**',async route=>{await gate;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'})});
 // Artwork is intentionally blocked here; the full load event can wait on those images.
 await page.goto('/games/riftbound-auction',{waitUntil:'domcontentloaded'});await startAuction(page,true);await expect(page.getByRole('dialog',{name:'Your Next Auction',exact:true})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(250000);expect((await saved(page)).auction).toBeNull();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-entry-art-lane').first()).toHaveCSS('animation-name','none');release();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();expect((await saved(page)).wallet.cash).toBe(245000);
});

test('Leave Auction confirms nonrefundable costs, preserves the wallet and cancels future play',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');
 await expect(page.getByRole('button',{name:'Leave Auction',exact:true})).toHaveCount(0);
 for(const kind of ['free','paid']){
  await startAuction(page,kind==='paid');await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();await page.locator('.auction-offers button').first().click();const state=await saved(page);
  await page.getByLabel('Bid (virtual USD)').fill('10');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.getByRole('button',{name:'Leave Auction',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Leave This Auction?',exact:true});await expect(dialog).toContainText('will not be refunded');await expect(dialog).toContainText(kind==='paid'?'$50.00':'$0.00');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const bounds=(await dialog.boundingBox())!;expect(Math.abs(bounds.x+bounds.width/2-width/2)).toBeLessThan(1);await page.screenshot({path:testInfo.outputPath(`leave-${kind}-${width}.png`),fullPage:true,animations:'disabled'});}
  await page.keyboard.press('Escape');expect((await saved(page)).auction).not.toBeNull();expect((await saved(page)).wallet).toEqual(state.wallet);
  await page.getByRole('button',{name:'Leave Auction',exact:true}).click();await page.getByRole('button',{name:'Confirm Leave',exact:true}).click();await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true})).toBeVisible();expect((await saved(page)).auction).toBeNull();expect((await saved(page)).wallet).toEqual(state.wallet);
  await page.clock.runFor(65000);await page.reload();await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true})).toBeVisible();expect((await saved(page)).wallet).toEqual(state.wallet);
 }
});

test('known high-value cards gain foil/glow without leaking unpriced cards, with themed collection names',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.lot=state.auction.lot.map((card:object,i:number)=>({...card,cents:i===0?10000:50000,rarity:'Showcase',section:'other-showcases'}));Object.assign(state.auction,{known:[0,1,4],priced:[0,4],rarityKnown:[2],publicReveals:[{round:1,slots:[0]}],lotTheme:'chase-collector'});state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await expect(page.locator('.auction-card[data-value-effect="foil"]')).toHaveCount(1);await expect(page.locator('.auction-card[data-value-effect="glow"]')).toHaveCount(1);await expect(page.locator('.auction-card.is-hidden[data-value-effect]')).toHaveCount(0);await expect(page.getByRole('button',{name:/price unknown/})).not.toHaveAttribute('data-value-effect');await expect(page.locator('.auction-card[data-value-effect="foil"]')).toHaveCSS('border-top-color','rgb(224, 84, 84)');
 const colors=[];for(const theme of ['bulk-seller','deck-builder','trade-binder','set-collector','chase-collector']){await page.evaluate(({key,theme})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.lotTheme=theme;state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,theme});colors.push(await page.locator('.auction-collection-heading h2').evaluate(element=>getComputedStyle(element).color));}expect(new Set(colors).size).toBe(5);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-card[data-value-effect="foil"]>.deferred-image').scrollIntoViewIfNeeded();await page.clock.runFor(1500);await expect(page.locator('.auction-card[data-value-effect="foil"]>.deferred-image')).toHaveClass(/is-loaded/);expect(await page.locator('.auction-card[data-value-effect="glow"]>.deferred-image').evaluate(element=>getComputedStyle(element).boxShadow)).not.toBe('none');await page.screenshot({path:testInfo.outputPath(`auction-foil-${width}-${theme}.png`),fullPage:true,animations:'disabled'});}
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.auction-card[data-value-effect="foil"]>.deferred-image').evaluate(element=>getComputedStyle(element,'::after').animationName)).toBe('none');
 const art=page.locator('.auction-card[data-value-effect="foil"]>.deferred-image');
 expect(await art.evaluate(element=>Number(getComputedStyle(element,'::after').zIndex))).toBeGreaterThan(await art.locator('img').evaluate(element=>Number(getComputedStyle(element).zIndex)));
 expect(await art.evaluate(element=>getComputedStyle(element,'::after').pointerEvents)).toBe('none');
 const withFoil=await art.screenshot({animations:'disabled'}),disableFoil=await page.addStyleTag({content:'.auction-card[data-value-effect]>.deferred-image::after{opacity:0!important}'}),withoutFoil=await art.screenshot({animations:'disabled'});expect(withFoil.equals(withoutFoil)).toBe(false);await disableFoil.evaluate(node=>node.parentNode?.removeChild(node));
 await page.locator('.auction-card[data-value-effect="foil"]').click();
 const inspection=page.getByRole('dialog').locator('.auction-inspection');await expect(inspection).toHaveAttribute('data-value-effect','foil');await page.clock.runFor(1500);await expect(inspection.locator('.deferred-image')).toHaveClass(/is-loaded/);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/price unknown/}).click();await expect(page.getByRole('dialog').locator('.auction-inspection')).not.toHaveAttribute('data-value-effect');await expect(page.getByRole('dialog')).toContainText('Price Unknown');await page.keyboard.press('Escape');
});

test('card inspection closes on outside clicks/taps, keeps inside drags open and puts its red Close control on the right',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({json:rows}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const card=page.getByRole('button',{name:/Inspect Auction Card/}).first();
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await card.click();const dialog=page.getByRole('dialog'),close=dialog.getByRole('button',{name:'Close',exact:true});await expect(dialog).toBeVisible();await page.clock.runFor(1400);await expect(dialog.locator('.auction-inspect-art')).toHaveClass(/is-loaded/);await expect(close).toHaveCSS('border-top-color','rgb(224, 84, 84)');
  const header=(await dialog.locator('.auction-dialog-heading').boundingBox())!,button=(await close.boundingBox())!,bounds=(await dialog.boundingBox())!;expect(button.x+button.width).toBeCloseTo(header.x+header.width,0);
  await page.mouse.click(bounds.x+4,bounds.y+4);await expect(dialog).toBeVisible();await dialog.getByRole('heading').click();await expect(dialog).toBeVisible();
  await page.mouse.move(header.x+4,header.y+4);await page.mouse.down();await page.mouse.move(8,8);await page.mouse.up();await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);await dialog.screenshot({path:testInfo.outputPath(`inspection-${width}-${theme}.png`)});
  if(width===390)await page.touchscreen.tap(8,8);else await page.mouse.click(8,8);await expect(dialog).toHaveCount(0);await expect(card).toBeFocused();
  await card.click();await close.click();await expect(dialog).toHaveCount(0);await card.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 }
});

test('NPC history reveals actual price/identity/rarity findings only after settlement counting',async({page})=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);const notes=[{id:'identity5',label:'Identity Peek',text:'2 identities revealed without prices.',round:1,reveals:[{slot:1,visibility:'price'},{slot:2,visibility:'identity'},{slot:3,visibility:'rarity'}]}];state.auction.npcs[0].findings=notes;state.auction.npcs[0].investigations=['identity5'];state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.auction.bids=[{name:'You',cents:100},{name:state.auction.npcs[0].name,cents:100,notes}];state.auction.bidHistory=[state.auction.bids];state.auction.stage='reveal';state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 const tile=page.locator('.auction-history-table tbody tr').nth(1).locator('button').first();await tile.focus();await expect(page.getByRole('tooltip')).not.toContainText('identities revealed');await expect(page.locator('.auction-clue-cards')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.stage='result';state.auction.result={winner:'You',bid:100,value:state.auction.lot.reduce((v:number,c:{cents:number})=>v+c.cents,0),fee:100,net:100,playerExpenses:0,buyout:true};state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.clock.runFor(1900);await expect(page.getByRole('heading',{name:'Auction Settled',exact:true})).toBeVisible();await tile.focus();await expect(page.locator('.auction-clue-cards')).toHaveCount(0);await page.keyboard.press('Escape');await finishReveal(page);
 const state=await saved(page);await tile.focus();await expect(page.locator('.auction-clue-cards li')).toHaveCount(3);await expect(page.locator('[data-visibility="price"]')).toContainText(state.auction.lot[1].name);await expect(page.locator('[data-visibility="price"]')).toContainText('$');await expect(page.locator('[data-visibility="identity"]')).toContainText(state.auction.lot[2].name);await expect(page.locator('[data-visibility="identity"]')).toContainText('Price Not Revealed');await expect(page.locator('[data-visibility="rarity"]')).not.toContainText(state.auction.lot[3].name);await expect(page.locator('[data-visibility="rarity"]')).toContainText('Rarity Only');await page.keyboard.press('Escape');
 await page.reload();await page.clock.runFor(1900);await page.getByRole('heading',{name:'Auction Settled',exact:true}).waitFor();await finishReveal(page);await tile.focus();await expect(page.locator('.auction-clue-cards li')).toHaveCount(3);await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:1000});await tile.tap();await expect(page.locator('.auction-clue-cards')).toBeVisible();
});

test('settled player history shows one round-specific investigation, including cumulative saved history',async({page},testInfo)=>{
 await fixtures(page);await page.emulateMedia({reducedMotion:'reduce'});await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 await page.evaluate(({key,options})=>{
  const state=JSON.parse(localStorage.getItem(key)!),first={id:options[0].id,label:options[0].label,text:'10 rarity markers.',round:1},second={id:options[1].id,label:options[1].label,text:'$123.00',round:2};
  const value=state.auction.lot.reduce((sum:number,card:{cents:number})=>sum+card.cents,0),fee=value*.1;
  Object.assign(state.auction,{stage:'result',round:3,clues:[first,second],bidHistory:[[{name:'You',cents:100,notes:[first]}],[{name:'You',cents:200,notes:[first,second]}],[{name:'You',cents:300,notes:[first,second]}]],result:{winner:'You',bid:300,value,fee,net:value-fee-300,playerExpenses:0,buyout:true}});
  state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));
 },{key,options:['core-mark10','alt-value-v3'].map(id=>INVESTIGATIONS.find(option=>option.id===id)!)});
 await page.clock.runFor(2000);await finishReveal(page);
 const cells=page.locator('.auction-history-table tbody tr').first().locator('td');
 await expect(cells.nth(0).locator('.auction-clue-icon')).toHaveCount(1);await expect(cells.nth(1).locator('.auction-clue-icon')).toHaveCount(1);await expect(cells.nth(2)).toContainText('No Private Clues');
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await cells.nth(1).getByRole('button').click();await expect(page.getByRole('tooltip')).toContainText('Alt-Art Valuation');await expect(page.getByRole('tooltip')).not.toContainText('Rarity Markers');await page.keyboard.press('Escape');
  await page.locator('.auction-bid-history').screenshot({path:testInfo.outputPath(`history-per-round-${width}-${theme}.png`),animations:'disabled'});
 }
 await page.reload();await page.clock.runFor(2000);await finishReveal(page);await expect(cells.nth(1).locator('.auction-clue-icon')).toHaveCount(1);
});

test('versioned investigations support a private marked-card follow-up and explicit paid final valuation price',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));let requests=0;
 await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});
 await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();const initialRequests=requests;
 const offer=async(id:string)=>page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=[option];state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));},{key,option:INVESTIGATIONS.find(row=>row.id===id)!});
 await offer('rare-mark12');await page.locator('.auction-offers button').click();const marked=await saved(page);expect(marked.auction.clues.at(-1).reveals.every((row:{visibility:string})=>row.visibility==='rarity')).toBe(true);
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));},key);
 await page.getByRole('button',{name:'Pass ($0)',exact:true}).click();await page.clock.runFor(500);await page.getByRole('button',{name:'Next Auction Round',exact:true}).click();await offer('follow-up');
 const select=page.getByLabel('Follow-Up Inspection',{exact:false});await expect(select).toBeVisible();const target=await select.locator('option').last().getAttribute('value');expect(target).not.toBeNull();await select.selectOption(target!);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.locator('.auction-follow-up').screenshot({path:testInfo.outputPath(`follow-up-${width}-${theme}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const before=await saved(page);await page.getByRole('button',{name:'Inspect Card · $8',exact:true}).click();const after=await saved(page);expect(after.wallet.cash).toBe(before.wallet.cash-800);expect(after.auction.priced).toContain(Number(target));expect(after.auction.clues.at(-1).reveals).toEqual([{slot:Number(target),visibility:'price'}]);expect(requests).toBe(initialRequests);
 await page.reload();await expect(page.locator('.auction-private-finding').filter({hasText:'Follow-Up Inspection'})).toBeVisible();expect(requests).toBe(initialRequests+11);
 await page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);Object.assign(state.auction,{kind:'paid',entryFee:5000,round:4,bought:false,selected:null,offers:[{...option,cost:12500}]});state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));},{key,option:INVESTIGATIONS.find(row=>row.id==='top2-final')!});
 await expect(page.locator('.auction-offers button')).toContainText('$125');const paid=await saved(page);await page.locator('.auction-offers button').click();expect((await saved(page)).wallet.cash).toBe(paid.wallet.cash-12500);expect(requests).toBe(initialRequests+11);
});

test('compact investigations color rarity text and paid follow-up selects a collection card without a dropdown',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));let requests=0;
 await page.route('**/data/*.json',route=>{requests++;return route.fulfill({json:rows})});await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const offer=async(id:string)=>page.evaluate(({key,option})=>{const s=JSON.parse(localStorage.getItem(key)!);s.auction.offers=[option];s.revision++;const raw=JSON.stringify(s);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));},{key,option:INVESTIGATIONS.find(row=>row.id===id)!});
 await offer('core-mark10');await expect(page.locator('.auction-offers')).toContainText('10 Rare, Epic or Alt-Art cards');await expect(page.locator('.auction-offers strong')).toHaveText('$5');await expect(page.locator('.auction-offers [data-rarity="rare"]').first()).not.toHaveCSS('color',await page.locator('.auction-offers small').evaluate(node=>getComputedStyle(node).color));
 await page.locator('.auction-offers button').click();await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key)!);s.auction.npcs=s.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));s.revision++;const raw=JSON.stringify(s);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));},key);
 await page.getByRole('button',{name:'Pass ($0)',exact:true}).click();await page.clock.runFor(500);await page.getByRole('button',{name:'Next Auction Round',exact:true}).click();await offer('follow-up-v4');await expect(page.locator('.auction-offers select')).toHaveCount(0);await expect(page.locator('.auction-offers strong')).toHaveText('$5');
 const before=await saved(page);await page.locator('.auction-offers button').click();await expect(page.getByRole('status').filter({hasText:'Choose a highlighted card'})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(before.wallet.cash-500);await page.reload();await expect(page.locator('.auction-card[data-follow-up]').first()).toBeVisible();
 const target=page.locator('.auction-card[data-follow-up]').first(),label=await target.getAttribute('aria-label'),slot=Number(/(\d+)$/.exec(label!)![1])-1;
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-investigate').screenshot({path:testInfo.outputPath(`pending-inspection-${width}-${theme}.png`)});await page.locator('.auction-collection').screenshot({path:testInfo.outputPath(`highlighted-cards-${width}-${theme}.png`)});}
 await target.click();const after=await saved(page);expect(after.auction.pendingFollowUp).toBeUndefined();expect(after.auction.clues.at(-1).reveals).toEqual([{slot,visibility:'price'}]);expect(after.wallet.cash).toBe(before.wallet.cash-500);await expect(page.locator('.auction-card[data-follow-up]')).toHaveCount(0);
 await page.evaluate(({key,option})=>{const s=JSON.parse(localStorage.getItem(key)!);Object.assign(s.auction,{round:4,bought:false,selected:null,offers:[option]});s.revision++;const raw=JSON.stringify(s);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}));},{key,option:INVESTIGATIONS.find(row=>row.id==='top-three-peek')!});await expect(page.locator('.auction-offers strong')).toHaveText('$40');const topBefore=await saved(page);await page.locator('.auction-offers button').click();const topAfter=await saved(page);expect(topAfter.wallet.cash).toBe(topBefore.wallet.cash-4000);expect(topAfter.auction.priced.length).toBe(topBefore.auction.priced.length+1);expect(requests).toBe(22);
});

test('optional auto advance counts down for twenty seconds, cancels safely, and never skips settlement',async({page})=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));let requests=0;
 await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Auto Advance: Off',exact:true})).toHaveAttribute('aria-pressed','false');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const force=()=>page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 const review=async()=>{await force();await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(500);await expect(page.getByRole('heading',{name:'Round Bids',exact:true})).toBeVisible()};
 await review();await page.getByRole('button',{name:'Auto Advance: Off',exact:true}).click();await expect(page.getByRole('button',{name:'Next Auction Round (20s)',exact:true})).toBeVisible();const before=await saved(page);
 await page.clock.runFor(5000);await expect(page.getByRole('button',{name:'Next Auction Round (15s)',exact:true})).toBeVisible();expect((await saved(page)).revision).toBe(before.revision);
 await page.getByRole('button',{name:'Auto Advance: On',exact:true}).click();await page.clock.runFor(21000);expect((await saved(page)).auction.round).toBe(1);await page.getByRole('button',{name:'Next Auction Round',exact:true}).click();
 await review();await page.getByRole('button',{name:'Auto Advance: Off',exact:true}).click();await page.clock.runFor(19500);expect((await saved(page)).auction.round).toBe(2);await page.clock.runFor(1000);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();expect((await saved(page)).auction.round).toBe(3);
 await review();await page.getByRole('button',{name:/^Next Auction Round \(/}).click();await page.clock.runFor(21000);expect((await saved(page)).auction.round).toBe(4);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();expect(requests).toBe(11);
 await page.reload();await expect(page.getByRole('button',{name:'Auto Advance: On',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();await force();await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(500);await page.clock.runFor(1800);await finishReveal(page);await page.clock.runFor(21000);await expect(page.getByRole('heading',{name:'Auction Settled',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Next Auction Round/})).toHaveCount(0);expect(requests).toBe(22);
});

test('flips and private investigations play distinct cues while mute suppresses both',async({page})=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');
 await page.evaluate(()=>{const Base=window.AudioContext;window.AudioContext=class extends Base{createOscillator(){const oscillator=super.createOscillator(),original=oscillator.frequency.setValueAtTime.bind(oscillator.frequency);oscillator.frequency.setValueAtTime=(value,time)=>{const root=document.documentElement,starts=JSON.parse(root.dataset.auctionSoundStarts??'[]');starts.push(value);root.dataset.auctionSoundStarts=JSON.stringify(starts);return original(value,time)};return oscillator}}});
 const starts=()=>page.evaluate(()=>JSON.parse(document.documentElement.dataset.auctionSoundStarts??'[]') as number[]);
 await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();await expect.poll(starts).toContain(700);
 const option=INVESTIGATIONS.find(option=>option.id==='identity3')!;await page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=[option];state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,option});await page.locator('.auction-offers button').click();await expect.poll(starts).toContain(660);
 await page.getByLabel('Bid (virtual USD)').fill('1');await expect(page.getByRole('button',{name:'Lock Bid',exact:true})).toHaveCSS('animation-name','auction-next-step');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'Lock Bid',exact:true})).toHaveCSS('animation-name','none');
 await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await expect(page.locator('.auction-locked-amount')).toContainText('Waiting for Bidders');await page.getByRole('button',{name:'Mute Sound',exact:true}).click();const count=(await starts()).length;
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.known=Array.from({length:state.auction.lot.length},(_,i)=>i);state.auction.clues.push({id:'sets',label:'Set Census',text:'Origins: 50',round:1});state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);await page.clock.runFor(1000);expect((await starts()).length).toBe(count);
});

test('round findings pair purple private tiles before public tiles with safe hover, keyboard and touch details',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));let requests=0;
 await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 for(const [index,id] of ['identity3','reveal3'].entries()){
  const round=index+1,option=INVESTIGATIONS.find(option=>option.id===id)!;
  await page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=[option];state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,option});
  await page.locator('.auction-offers button').click();const state=await saved(page),clue=state.auction.clues.at(-1),group=page.getByRole('region',{name:`Round ${round} investigation information`}),privateTile=group.locator('.auction-private-finding'),publicTile=group.locator('.auction-shared-reveal');
  await expect(privateTile).toContainText('Your Investigation');expect((await privateTile.boundingBox())!.y).toBeLessThan((await publicTile.boundingBox())!.y);
  await privateTile.focus();await expect(page.locator('.auction-finding-popup')).toContainText(investigationDescription(clue.text));
  const card=state.auction.lot[clue.reveals[0].slot];await expect(page.locator('.auction-finding-popup')).toContainText(card.name);
  if(id==='identity3')await expect(page.locator('.auction-finding-popup')).not.toContainText('$');else await expect(page.locator('.auction-finding-popup')).toContainText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(card.cents/100));
  await page.keyboard.press('Escape');await expect(page.locator('.auction-finding-popup')).toHaveCount(0);await publicTile.hover();await expect(page.locator('.auction-finding-popup')).toContainText(state.auction.lot[state.auction.publicReveals.at(-1).slots[0]].name);await page.keyboard.press('Escape');
  if(round===1){await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(500);await page.getByRole('button',{name:'Next Auction Round',exact:true}).click()}
 }
 await expect(page.locator('.auction-investigation-round').first()).toContainText('Round 2');
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const tile=page.locator('.auction-private-finding').first();await tile.tap();await expect(page.locator('.auction-finding-popup')).toBeVisible();expect(await page.locator('.auction-finding-popup').evaluate(element=>{const r=element.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})).toBe(true);await expect(page.locator('.auction-popup-scroll')).toHaveCSS('scrollbar-width','thin');await expect(page.locator('.auction-finding-popup')).toHaveCSS('overflow','hidden');await page.locator('.auction-finding-popup').screenshot({path:testInfo.outputPath(`finding-tooltip-${width}-${theme}.png`)});await page.keyboard.press('Escape');await page.locator('.auction-investigate').screenshot({path:testInfo.outputPath(`paired-findings-${width}-${theme}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 expect(requests).toBe(11);await page.reload();await expect(page.locator('.auction-private-finding')).toHaveCount(2);
});

test('compact round review ranks each bidder and centers status with next-round action above the table',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const force=async(bids:number[])=>page.evaluate(({key,bids})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.lotTheme='deck-builder';state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,bid:bids[index],locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,bids});
 await force([200,150,100]);await expect(page.locator('.auction-collection-heading h2')).toContainText("Deck Builder's Collection");await expect(page.locator('.auction-lot-theme')).toHaveCount(0);await page.getByRole('button',{name:'Collection theme',exact:true}).click();await expect(page.getByRole('tooltip')).toContainText('Not a verified competitive deck');await page.keyboard.press('Escape');
 await page.getByLabel('Bid (virtual USD)').fill('1.50');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(500);
 await page.locator('.auction-round-review-heading').getByRole('button',{name:'Round review rules'}).click();await expect(page.getByRole('tooltip')).toContainText('seeded priority');await page.keyboard.press('Escape');
 for(let round=1;round<=2;round++){
  await expect(page.getByRole('heading',{name:'Round Bids',exact:true})).toBeVisible();
  const state=await saved(page);for(let column=0;column<round;column++)for(const [index,bid] of rankAuctionBids(state.auction.bidHistory[column],state.auction.seed).entries()){const row=page.locator('.auction-history-table tbody tr').filter({has:page.locator('th',{hasText:bid.name})});await expect(row.locator('button').nth(column)).toContainText(auctionPlacementLabel(index+1));await expect(row.locator('button').nth(column)).toHaveAttribute('aria-label',new RegExp(`${auctionPlacementLabel(index+1)} place`))}
  await expect(page.locator('.auction-results .auction-placement')).toHaveCount(round*4);
  for(const width of [1440,390,320])for(const theme of ['dark','light']){
   await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const placement=await page.locator('.auction-round-review-heading').evaluate(element=>{const row=element.getBoundingClientRect(),status=element.querySelector('.auction-no-buyout')!.getBoundingClientRect(),next=element.querySelector('.auction-next-round')!.getBoundingClientRect();return {center:Math.abs(row.x+row.width/2-status.x-status.width/2),right:Math.abs(row.right-next.right),sameLine:next.top<status.bottom&&next.bottom>status.top}});expect(placement.center).toBeLessThan(1);expect(placement.right).toBeLessThan(1);expect(placement.sameLine).toBe(true);const cells=await page.locator('.auction-history-cell').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));expect(cells.every(height=>height>=44&&height<=80)).toBe(true);expect((await page.locator('.auction-bid-history').boundingBox())!.width).toBeGreaterThan(width-140);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(round===2)await page.locator('.auction-results').screenshot({path:testInfo.outputPath(`compact-round-review-${width}-${theme}.png`),animations:'disabled'});
  }
  await page.getByRole('button',{name:'Next Auction Round',exact:true}).click();if(round===1){await force([250,230,200]);await page.getByLabel('Bid (virtual USD)').fill('2.40');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(500)}
 }
 await force([100,50,1]);await page.getByLabel('Bid (virtual USD)').fill('10');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(500);await page.clock.runFor(1800);await finishReveal(page);await expect(page.locator('.auction-collection-heading h2')).toContainText("Deck Builder's Collection Revealed");expect(await page.getByRole('heading',{name:'Bid History',exact:true}).evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(22);await page.locator('.auction-results').screenshot({path:testInfo.outputPath('compact-settled-history.png'),animations:'disabled'});
 for(const width of [1920,1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const summary=(await page.locator('.auction-settlement-summary').boundingBox())!,history=(await page.locator('.auction-settlement-layout>.auction-bid-history').boundingBox())!;
  if(width===1920){expect(history.x).toBeGreaterThan(summary.x+summary.width);expect(Math.abs(history.y-summary.y)).toBeLessThan(1)}
  else{expect(history.y).toBeGreaterThan(summary.y+summary.height);expect(history.width).toBeGreaterThan(width-140)}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.auction-results').screenshot({path:testInfo.outputPath(`responsive-settlement-${width}-${theme}.png`),animations:'disabled'});
 }
});

test('balanced investigations mark rarities without identities, count whole categories and reveal larger priced samples',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));let requests=0;
 const bands=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','signatures']];
 const cards=bands.flatMap(([rarity,section],tier)=>Array.from({length:10},(_,i)=>({...rows[0],productId:980000+tier*10+i,name:`Balance Card ${tier}-${i}`,image:`https://images.example/balance/${tier}-${i}.svg`,rarity,section,marketPrice:1+tier+i/100})));
 await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(cards)})});await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();const base=await saved(page),initialRequests=requests;
 const cases=[['rare-mark8',8,'mark'],['epic-mark5',5,'mark'],['alt-mark3',3,'mark'],['highest-rarity',1,'top'],['common-count',10,'count'],['uncommon-count',10,'count'],['rare8',8,'scan'],['epic5',5,'scan'],['alt3',3,'scan']] as const;
 for(const [id,count,kind] of cases){
  const option=INVESTIGATIONS.find(option=>option.id===id)!;
  await page.evaluate(({key,base,cards,option})=>{const current=JSON.parse(localStorage.getItem(key)!);const state={...base,revision:current.revision+1,auction:{...base.auction,lot:cards.map(card=>({productId:card.productId,printing:card.printing,name:card.name,image:card.image,set:card.set,rarity:card.rarity,section:card.section,cents:Math.round(card.marketPrice*100)})),range:[60,60],round:1,known:[],priced:[],publicReveals:[],rarityKnown:[],offers:[option],clues:[],bought:false,selected:null,npcs:base.auction.npcs.map((npc:object)=>({...npc,sample:[],inspected:[],identified:[],investigations:[]}))}};const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,base,cards,option});
  await page.locator('.auction-offers button').click();await expect(page.getByRole('heading',{name:/Investigation Results/})).toBeVisible();const after=await saved(page);expect(after.wallet.cash).toBe(250000-option.cost);
  if(kind==='scan'){await expect(page.locator('button.auction-card')).toHaveCount(count);expect(after.auction.priced.length).toBe(count)}else{await expect(page.locator('button.auction-card')).toHaveCount(0);expect(after.auction.priced.length).toBe(0);await expect(page.locator('.auction-known-value strong')).toHaveText('$0.00')}
  if(kind==='mark'||kind==='top')await expect(page.locator('.auction-rarity-marker')).toHaveCount(count);
  if(kind==='count')await expect(page.locator('.auction-clues')).toContainText(`10 ${id==='common-count'?'common':'uncommon'} cards.`);
  if(kind==='top'){
   expect(after.auction.topCardSlot).toBe(59);await expect(page.locator('.auction-rarity-marker')).toContainText('Top Card · Signature');await expect(page.locator('.auction-clues')).toContainText('Top card rarity: Signature');await expect(page.locator('.auction-investigate')).not.toContainText('Balance Card');
   for(const theme of ['dark','light']){await page.setViewportSize({width:390,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.locator('.auction-collection').screenshot({path:testInfo.outputPath(`top-card-rarity-${theme}.png`)})}
   await page.reload();await expect(page.locator('.auction-rarity-marker')).toContainText('Top Card · Signature');expect((await saved(page)).auction.topCardSlot).toBe(59);
  }
 }
 expect(requests).toBe(initialRequests+11);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('investigation retains public and private findings across rounds with opening flips and centered known value',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));let requests=0;
 await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true})).toBeEnabled();const lobby=await page.locator('main.games-page').boundingBox();expect(lobby!.width).toBeLessThan(1440);expect(Math.abs(lobby!.x+lobby!.width/2-720)).toBeLessThan(1);await expect(page.locator('main.games-page')).not.toHaveCSS('max-width','none');await startAuction(page);await expect(page.locator('.auction-investigate > h2')).toHaveText(/Investigation/);await expect(page.locator('main.games-page')).toHaveCSS('max-width','none');const arenaWidth=await page.locator('main.games-page').boundingBox();expect(Math.abs(arenaWidth!.width-1440)).toBeLessThan(1);
 const opening=await saved(page),base=Math.ceil(opening.auction.lot.length*.05)+1;expect(opening.auction.known.length).toBeGreaterThanOrEqual(base);expect(opening.auction.known.length).toBeLessThanOrEqual(base+2);
 const initialRequests=requests,clues:string[]=[];
 for(let round=1;round<=4;round++){
  await expect(page.locator('.auction-bidding .auction-clue-icon')).toHaveCount(0);
  await expect(page.locator('.auction-active-history')).toHaveCount(round>1?1:0);
  if(round>1)await expect(page.locator('.auction-active-history [data-completed="true"]')).toHaveCount((round-1)*4);
  const before=await saved(page),panel=page.locator('.auction-investigate');await expect(panel.locator('.auction-shared-reveal')).toHaveCount(round);await expect(page.locator('.auction-collection .auction-shared-reveal')).toHaveCount(0);
  await expect(panel.locator('.auction-investigation-round.is-new')).toContainText(`Round ${round}`);await expect(panel.locator('.auction-investigation-round.is-new')).toHaveCSS('animation-name','auction-public-pop');
  const shared=before.auction.publicReveals.at(-1);await expect(panel.locator('.auction-shared-reveal').first()).toContainText(`${shared.slots.length} cards with prices`);await expect(panel.locator('.auction-shared-reveal li')).toHaveCount(0);
  await expect(page.locator('.auction-collection button.is-flipping')).toHaveCount(shared.slots.length);
  const id=round===1?'identity3':round===2?'reveal3':round===3?'bulk':'top2',option=INVESTIGATIONS.find(option=>option.id===id)!;
  await page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=[option];state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,option});
  await panel.locator('.auction-offers button').click();await expect(panel.getByRole('heading',{name:/Investigation Results/})).toBeVisible();const after=await saved(page);clues.push(after.auction.clues.at(-1).label);await expect(panel.locator('.auction-clues li')).toHaveCount(round);for(const clue of clues)await expect(panel.locator('.auction-clues').filter({hasText:clue})).toHaveCount(1);
  expect(after.auction.clues.at(-1).round).toBe(round);
  await expect(panel.getByRole('region',{name:`Round ${round} investigation information`})).toContainText(option.label);
  await page.setViewportSize({width:1440,height:1000});
  const heights=await page.locator('.auction-investigate,.auction-bidding').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));expect(Math.abs(heights[0]-heights[1])).toBeLessThan(1);
  const publicSlots=new Set(after.auction.publicReveals.flatMap((reveal:{slots:number[]})=>reveal.slots));await expect(page.locator('.auction-public-marker')).toHaveCount(publicSlots.size);await expect(panel.locator('.auction-private-cards')).toHaveCount(0);await expect(panel).not.toContainText('Auction Card');
  const expected=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(after.auction.priced.reduce((sum:number,slot:number)=>sum+after.auction.lot[slot].cents,0)/100);await expect(page.locator('.auction-known-value strong')).toHaveText(expected);
  if(round===2){
   await page.emulateMedia({reducedMotion:'reduce'}); // Measure layout, not the transient projected width during a flip.
   for(const width of [1440,390,320])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await expectCollectionHeading(page);const sizes=await page.locator('.auction-card').evaluateAll(elements=>elements.map(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height})));expect(Math.max(...sizes.map(size=>size.width))-Math.min(...sizes.map(size=>size.width))).toBeLessThan(1);expect(sizes.every(size=>size.height===300)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await panel.screenshot({path:testInfo.outputPath(`investigation-memory-${width}-${theme}.png`)});await page.locator('.auction-collection-heading').screenshot({path:testInfo.outputPath(`known-value-${width}-${theme}.png`)})}
   await page.emulateMedia({reducedMotion:'reduce'});await expect(panel.locator('.auction-investigation-round.is-new')).toHaveCSS('animation-name','none');await expect(page.locator('.auction-collection button.is-flipping').first()).toHaveCSS('animation-name','none');await page.emulateMedia({reducedMotion:'no-preference'});
  }
  if(round===4){
   const scroll=panel.getByRole('region',{name:'Investigation options and round findings'});await scroll.focus();await page.keyboard.press('End');
   await expect.poll(()=>scroll.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
   await expect(panel.locator('.auction-investigation-round').first()).toContainText('Round 4');break;
  }
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);await page.getByRole('button',{name:'Pass ($0)',exact:true}).click();await page.clock.runFor(500);await expect(page.locator('.auction-results .auction-history-table button')).toHaveCount(round*4);await expect(page.locator('.auction-history-table .is-pending')).toHaveCount((4-round)*4);await expect(page.locator('section.auction-bid-history,.auction-round-bids')).toHaveCount(0);await page.getByRole('button',{name:'Next Auction Round',exact:true}).click();
 }
 expect(requests).toBe(initialRequests);const beforeReload=await saved(page);await page.reload();await expect(page.locator('.auction-investigate .auction-shared-reveal')).toHaveCount(4);await expect(page.locator('.auction-clues li')).toHaveCount(4);expect((await saved(page)).wallet).toEqual(beforeReload.wallet);
});

test('settlement heading actions, inline count and collection-only rarity hover remain usable across screen sizes',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));
 const bands=[['Common','commons'],['Uncommon','uncommons'],['Rare','rares'],['Epic','epics'],['Epic','alt-arts'],['Epic','overnumbered'],['Epic','signatures'],['Promo','riftbound-promos']];
 const cards=Array.from({length:56},(_,index)=>({...rows[index%rows.length],productId:990000+index,name:`Collection Card ${index}`,image:`https://images.example/collection/${index}.svg`,rarity:bands[index%bands.length][0],section:bands[index%bands.length][1],marketPrice:1+index/100}));
 await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(cards)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 await page.evaluate(({key,cards})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.lot=cards.map(row=>({productId:row.productId,name:row.name,image:row.image,set:row.set,rarity:row.rarity,section:row.section,printing:row.printing,cents:Math.round(row.marketPrice*100)}));state.auction.range=[cards.length,cards.length];state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,cards});
 const unknown=page.locator('.auction-card.is-hidden:not([data-rarity])').first();await unknown.hover();await expect(unknown).toHaveCSS('box-shadow','none');await expect(unknown).not.toHaveAttribute('data-rarity');
 await expect(page.locator('.auction-bidding hr')).toHaveCount(1);expect(await page.locator('.auction-npcs li').evaluateAll(elements=>elements.every(element=>getComputedStyle(element,'::after').content==='none'))).toBe(true);
 await page.getByLabel('Bid (virtual USD)').fill('10');await page.getByLabel('Bid (virtual USD)').press('Enter');await page.clock.runFor(250);await page.clock.runFor(1600);await expect(page.getByRole('heading',{name:'Auction Settled',exact:true})).toBeVisible();
 const finish=page.locator('.auction-results-heading').getByRole('button',{name:'Finish & Manage Inventory',exact:true});await expect(finish).toBeDisabled();await expect(page.locator('.auction-settled-winner')).toContainText('won by early buyout for $10.00.');await expect(page.locator('.auction-settled-winner').getByRole('button',{name:'Collection value explanation'})).toBeVisible();
 await page.getByRole('button',{name:'Skip Reveal'}).click();await expect(finish).toBeEnabled();await expect(page.getByText('Collection Count Complete',{exact:true})).toHaveCount(0);await expect(page.getByText(/Counting Collection/)).toHaveCount(0);await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [1440,390,320])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const alignment=await page.locator('.auction-results-heading').evaluate(element=>{const title=element.querySelector('h2')!.getBoundingClientRect(),button=element.querySelector('button')!.getBoundingClientRect(),row=element.getBoundingClientRect();return {difference:Math.abs(title.y+title.height/2-button.y-button.height/2),right:Math.abs(row.right-button.right)}});expect(alignment.difference).toBeLessThan(1);expect(alignment.right).toBeLessThan(1);
  const inline=await page.locator('.auction-copy-count').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element.firstChild!);const number=range.getBoundingClientRect(),label=element.querySelector('small')!.getBoundingClientRect();return label.left>=number.right&&label.top<number.bottom});expect(inline).toBe(true);
  for(const rarity of ['common','uncommon','rare','epic','premium','promo']){const card=page.locator(`button.auction-card[data-rarity="${rarity}"]`).first();const border=await card.evaluate(element=>getComputedStyle(element).borderTopColor);await card.hover();await expect(card).toHaveCSS('border-top-color',border);const shadow=await card.evaluate(element=>getComputedStyle(element).boxShadow);expect(shadow).toContain(border)}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-results').screenshot({path:testInfo.outputPath(`settlement-header-${width}-${theme}.png`)});await page.locator('.auction-collection-heading').screenshot({path:testInfo.outputPath(`inline-count-${width}-${theme}.png`)});
 }
});

test('new rivals have original portraits, distinct visible strategies and resumable seats',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const profiles=AUCTION_NPCS.filter(npc=>['The Archivist','The Playset Builder','The Skeptic'].includes(npc.name));
 await page.evaluate(({key,names})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,name:names[index]}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,names:profiles.map(npc=>npc.name)});
 for(const npc of profiles){const identity=page.locator('.auction-npcs .auction-bidder-identity').filter({hasText:npc.name});await expect(identity.locator(':scope > small')).toHaveCount(0);await identity.getByRole('button',{name:`${npc.name} profile`}).click();await expect(page.getByRole('tooltip')).toContainText(npc.strategy);await expect(page.getByRole('tooltip')).toContainText('Favored investigations');await page.keyboard.press('Escape');await expect(identity.locator('img')).toHaveAttribute('src',`/images/games/auction-${npc.portrait}.webp`);await expect.poll(()=>identity.locator('img').evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(192)}
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-bidding').screenshot({path:testInfo.outputPath(`new-rivals-${width}-${theme}.png`)})}
 await page.reload();for(const npc of profiles)await expect(page.locator('.auction-npcs')).toContainText(npc.name);
});

test('investigation icons use target rarity or general clue tier colors and offers have heading space',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const targets:Record<string,string>={'rare-mark8':'rare','epic-mark5':'epic','alt-mark3':'epic','common-count':'common','uncommon-count':'uncommon',common3:'common',uncommon3:'uncommon',rare2:'rare','rare-mark2':'rare','rare-identity2':'rare',rares:'rare',epic2:'epic','epic-mark2':'epic','epic-identity2':'epic',alt1:'epic','alt-mark1':'epic',chase1:'premium','chase-mark1':'premium','chase-identity1':'premium'};
 Object.assign(targets,{'rare-mark12':'rare','epic-mark8':'epic','alt-mark5':'epic','rare-identity8':'rare','epic-identity5':'epic',rare12:'rare',epic6:'epic',alt4:'epic','chase-mark-v2':'premium','chase-identity-v2':'premium','chase-scan-v2':'premium','rares-v2':'rare'});
 const tierTones={basic:'common',targeted:'rare',strong:'epic',premium:'premium'},tokens={common:'--gray',uncommon:'--tone-up',rare:'--blue',epic:'--purple',premium:'--tone-favorite'};
 const options=INVESTIGATIONS.filter(option=>!RETIRED_INVESTIGATION_IDS.includes(option.id));
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(let offset=0;offset<options.length;offset+=3){const batch=options.slice(offset,offset+3);await page.evaluate(({key,offers})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=offers;state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,offers:batch});
   for(const option of batch){const tone=targets[option.id]??tierTones[option.tier],icon=page.locator(`.auction-offers [data-investigation="${option.id}"] .auction-clue-icon`);await expect(icon).toHaveAttribute('data-tone',tone);const expected=await icon.evaluate((element,token)=>{const probe=document.createElement('span');probe.style.color=`var(${token})`;element.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color},tokens[tone as keyof typeof tokens]);await expect(icon).toHaveCSS('color',expected);await expect(icon).toHaveAttribute('aria-hidden','true')}
  }
  const space=await page.locator('.auction-investigate').evaluate(element=>element.querySelector('.auction-offers')!.getBoundingClientRect().top-element.querySelector('h2')!.getBoundingClientRect().bottom);expect(space).toBeGreaterThanOrEqual(24);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-investigate').screenshot({path:testInfo.outputPath(`clue-colors-${width}-${theme}.png`)});
 }
});

test('rarity-only investigations keep identities and prices hidden and the paid entry text has no separate background',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');
 const paidText=page.locator('.auction-entry-card.is-premium > span');await expect(paidText).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 // The daily entry also has a number badge; inspect every card's caption, not its badge.
 for(const color of ['dark','light']){await page.evaluate(color=>document.documentElement.dataset.theme=color,color);for(const entry of await page.locator('.auction-entry-card').all()){await entry.hover();const caption=entry.locator(':scope > span:last-child');await expect(caption).toHaveCount(1);for(const side of ['top','right','bottom','left'])await expect(caption).toHaveCSS(`border-${side}-width`,'0px');await expect(caption).toHaveCSS('box-shadow','none');await expect(caption).toHaveCSS('background-color','rgba(0, 0, 0, 0)')}}
 await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const before=await saved(page),option=INVESTIGATIONS.find(option=>option.id==='rarity-peek3')!;
 await page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=[option];state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,option});
 await page.getByRole('button',{name:/Rarity Peek/}).click();await expect(page.locator('.auction-rarity-marker')).toHaveCount(3);
 const after=await saved(page);expect(after.auction.known).toEqual(before.auction.known);expect(after.auction.priced).toEqual(before.auction.priced);expect(after.wallet.cash).toBe(before.wallet.cash-option.cost);
 const marked=page.locator('.auction-card.is-hidden[data-rarity]');await expect(marked).toHaveCount(3);await expect(marked.locator('strong')).toHaveCount(0);await expect(marked.first()).not.toContainText(/Auction Card|\$/);await expect(marked.first().locator('img')).toHaveAttribute('src','/images/games/riftbound-card-back.webp');
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`rarity-markers-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
});
test('collection titles and rival profiles retain accessible theme/strategy tooltips across reload without extra data calls',async({page},testInfo)=>{
 await fixtures(page);let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});
 await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const before=await saved(page),theme=page.locator('.auction-collection-heading h2');await expect(page.locator('.auction-lot-theme')).toHaveCount(0);await theme.getByRole('button',{name:'Collection theme'}).click();await expect(page.getByRole('tooltip')).toContainText('not guaranteed contents or value');await page.keyboard.press('Escape');
 const label=await theme.textContent();await expect(page.locator('.auction-bidder-identity > small')).toHaveCount(0);await expect(page.locator('.auction-bidder-identity .info-hint button')).toHaveCount(3);expect(requests).toBe(11);
 for(const width of [1440,390])for(const color of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(color=>document.documentElement.dataset.theme=color,color);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-bidding').screenshot({path:testInfo.outputPath(`strategies-${width}-${color}.png`)});await page.locator('.auction-collection-heading').screenshot({path:testInfo.outputPath(`theme-${width}-${color}.png`)})}
 await page.reload();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();await expect(theme).toHaveText(label!);await expect(page.locator('.auction-bidder-identity .info-hint button')).toHaveCount(3);expect((await saved(page)).auction.lot).toEqual(before.auction.lot);expect(requests).toBe(22);
});
async function finishReveal(page:Page){const skip=page.getByRole('button',{name:'Skip Reveal'});if(await skip.count())await skip.click();await expect(page.getByRole('button',{name:'Finish & manage inventory'})).toBeEnabled();const prices=await page.locator('.auction-collection-grid > button > strong').allTextContents();const values=prices.map(price=>Number(price.replace(/[^0-9.]/g,'')));expect(values.every((value,index)=>index===0||values[index-1]>=value)).toBe(true);const state=await saved(page),shared=new Set(state.auction.publicReveals.flatMap((reveal:{slots:number[]})=>reveal.slots));await expect(page.locator('.auction-public-marker')).toHaveCount(shared.size);await expect(page.locator('.auction-known-value strong')).toHaveText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(state.auction.result.value/100))}
async function expectSettledPosition(page:Page){const top=await page.locator('#auction-settled').evaluate(element=>element.getBoundingClientRect().top);expect(top).toBeGreaterThanOrEqual(124);expect(top).toBeLessThanOrEqual(126)}
async function expectConsolidatedResults(page:Page){await expect(page.getByRole('timer')).toHaveText('Auction Finished');await expect(page.locator('.auction-result-metrics > div')).toHaveCount(6);await expect(page.getByText('Gross Market Spread',{exact:true})).toHaveCount(0)}
async function expectCollectionHeading(page:Page){
 const boxes=await page.locator('.auction-collection-heading').evaluate(element=>{const center=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}};return {row:center(element),title:center(element.querySelector('h2')!),value:center(element.querySelector('.auction-value-controls')!),count:center(element.querySelector('.auction-copy-count')!)}});
 expect(Math.abs(boxes.row.x-boxes.value.x)).toBeLessThan(1);if(page.viewportSize()!.width>600)expect(Math.abs(boxes.title.y-boxes.value.y)).toBeLessThan(1);expect(Math.abs(boxes.count.y-boxes.title.y)).toBeLessThan(1);
}

test('entry briefing keeps broken artwork excluded while preparation rerolls safely',async({page})=>{
 await fixtures(page);const cards=Array.from({length:90},(_,index)=>({...rows[index%24],productId:980000+index,name:`Entry Card ${index}`,image:`https://images.example/entry/${index}.svg`,marketPrice:1+index/10}));
 const failed=new Set<string>();let probes=0;await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(cards)}));
 await page.route('https://images.example/**',async route=>{await new Promise(resolve=>setTimeout(resolve,60));if(failed.has(route.request().url())||probes++<20){failed.add(route.request().url());return route.fulfill({status:404,body:'Missing'})}return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'})});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true})).toBeEnabled();await expect(page.locator('.auction-entry-card img')).toHaveCount(3);await expect.poll(()=>page.locator('.auction-entry-card img').evaluateAll(elements=>elements.every(element=>(element as HTMLImageElement).naturalWidth>0))).toBe(true);
 await startAuction(page,false,false);await expect(page.getByRole('status').filter({hasText:'Starting Auction…'})).toBeVisible();await page.getByRole('button',{name:'Skip Intro',exact:true}).click();await expect(page.locator('.auction-lobby .detail-skeleton')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const state=await saved(page);expect(state.wallet.cash).toBe(250000);expect(state.auction.lot.every((card:{image:string})=>!failed.has(card.image))).toBe(true);await expect(page.getByText(/Not enough cards with working artwork/)).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('paid entry charges $50 once after artwork checks, offers larger collections, and uses accessible pulsing entry controls',async({page},testInfo)=>{
 await fixtures(page);let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});await page.goto('/games/riftbound-auction');
 const free=page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true}),paid=page.getByRole('button',{name:'Enter Piltover Auction House · $50 Fee',exact:true});await expect(free).toBeEnabled();await expect(paid).toBeEnabled();await expect(free).toContainText('25–90 cards');await expect(paid).toContainText('50–130 cards');await expect(free).toHaveCSS('animation-name','auction-entry-pulse');await expect(paid).toHaveCSS('animation-name','auction-entry-pulse');await page.emulateMedia({reducedMotion:'reduce'});await expect(paid).toHaveCSS('animation-name','none');
 await paid.click();await expect(page.locator('.auction-lobby .detail-skeleton')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();let state=await saved(page);expect(state.wallet.cash).toBe(245000);expect(state.auction.kind).toBe('paid');expect(state.auction.lot.length).toBeGreaterThanOrEqual(50);expect(state.auction.lot.length).toBeLessThanOrEqual(130);expect(state.auction.deadline-state.auction.npcs[0].lockAt).toBeLessThan(60000);await expect(page.locator('.auction-round-header')).toHaveClass(/detail-section/);await expect(page.getByRole('link',{name:/Jump to Bid/})).toHaveCount(0);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`paid-auction-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.reload();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(245000);
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.getByLabel('Bid (virtual USD)').fill('2450');await page.getByLabel('Bid (virtual USD)').press('Enter');await page.clock.runFor(250);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await expectConsolidatedResults(page);state=await saved(page);expect(state.wallet.cash).toBe(0);await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Auction Entry Fee'})).toContainText('-$50.00');await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Selling Fee'}).locator('dd')).toHaveText(/^-/);expect(requests).toBe(22);
});

test('rarity inventory sales confirm precise proceeds and lobby facts and timing tooltip work across themes',async({page},testInfo)=>{
 await fixtures(page);let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});
 await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({version:1,revision:0,sequence:0,auction:null,wallet:{cash:250000,feeBps:1000,inventory:[{productId:970000,printing:'Normal',quantity:3},{productId:970012,printing:'Normal',quantity:2},{productId:999,printing:'Normal',quantity:1}]}})),{key});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House'})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true})).toBeVisible();await page.getByRole('button',{name:'Auction timing and preparation'}).click();await expect(page.getByRole('tooltip')).toContainText('Background tabs and reloads do not pause');await page.keyboard.press('Escape');
 await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).click();await expect(page.getByRole('button',{name:'Sell Commons',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sell Rares',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sell Uncommons',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Sell All',exact:true})).toBeEnabled();
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`auction-lobby-sales-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.getByRole('button',{name:'Sell Commons',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sell Commons?'})).toContainText('$2.70');await page.getByRole('button',{name:'Close',exact:true}).click();expect((await saved(page)).wallet.inventory).toHaveLength(3);
 await page.getByRole('button',{name:'Sell Commons',exact:true}).click();await page.getByRole('button',{name:'Confirm sale'}).click();const sold=await saved(page);expect(sold.wallet.cash).toBe(250270);expect(sold.wallet.inventory.map((row:{productId:number})=>row.productId)).toEqual([970012,999]);await expect(page.getByRole('button',{name:'Sell Commons',exact:true})).toBeDisabled();expect(requests).toBe(11);
});

test('NPC overpayment shares its loss, credits once, and shows the player net result after expenses',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();await page.locator('.auction-offers button').first().click();
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,bid:index===0?250000:1,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.getByRole('button',{name:'Pass ($0)'}).click();await page.clock.runFor(250);await page.clock.runFor(1800);await finishReveal(page);
 const state=await saved(page),result=state.auction.result,share=result.lossShares.find((row:{name:string})=>row.name==='You').cents;expect(result.net).toBeLessThan(0);expect(result.lossShares.reduce((sum:number,row:{cents:number})=>sum+row.cents,0)).toBe(-result.net);expect(state.wallet.cash).toBe(250000-result.playerExpenses+share);expect(state.wallet.inventory).toHaveLength(0);
 await expect(page.getByRole('heading',{name:'NPC Loss Shared'})).toBeVisible();await expect(page.locator('.auction-loss-shares li')).toHaveCount(3);await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Your Auction Result'})).toContainText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((share-result.playerExpenses)/100));await expect(page.locator('.auction-loss-expand')).toHaveCSS('animation-name','auction-loss-expand');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-loss-expand')).toHaveCSS('animation-name','none');
 await page.reload();await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);expect((await saved(page)).wallet.cash).toBe(state.wallet.cash);await page.getByRole('button',{name:'Finish & manage inventory'}).click();expect((await saved(page)).wallet.cash).toBe(state.wallet.cash);
});

test('settlement skeletons count alongside revealed cards and previous bids stay public-only through rounds two to four',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const boxes=await page.locator('.auction-offers button').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().toJSON()));expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);expect(boxes[2].top).toBeGreaterThanOrEqual(boxes[1].bottom);
 for(let round=1;round<=4;round++){
  await expect(page.locator('.auction-investigate .auction-investigation-round').first()).toContainText(`Round ${round}`);
  await expect(page.locator('.auction-previous-bids')).toHaveCount(round===1?0:4);
  await expect(page.locator('.auction-previous-bids > small')).toHaveCount(0);await expect(page.locator('.auction-previous-bids .is-round-leader')).toHaveCount(round>1?1:0);
  await expect(page.locator('.auction-prior-bid')).toHaveCount(round>1?4:0);await expect(page.getByText('Previous Bids',{exact:true})).toHaveCount(0);
  if(round>1){for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const positions=await page.locator('.auction-npcs li').first().evaluate(element=>{const status=element.querySelector('.auction-bid-status')!.getBoundingClientRect(),previous=element.querySelector('.auction-previous-bids')!.getBoundingClientRect();return {statusRight:status.right,previousLeft:previous.left}});expect(positions.previousLeft).toBeGreaterThan(positions.statusRight);const heights=await page.locator('.auction-npcs li').evaluateAll(elements=>elements.map(element=>Math.abs(element.querySelector('.auction-bid-status')!.getBoundingClientRect().height-element.querySelector('.auction-prior-bid')!.getBoundingClientRect().height)));expect(heights.every(delta=>delta<1)).toBe(true);await expect(page.locator('.auction-previous-bids').first().locator('strong')).toHaveCount(1)}await page.screenshot({path:testInfo.outputPath(`previous-bids-round-${round}.png`),fullPage:true,animations:'disabled'})}
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
  await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByLabel('Bid (virtual USD)').press('Enter');await page.clock.runFor(250);
  if(round<4){await expect(page.getByRole('heading',{name:'Round Bids',exact:true})).toBeVisible();await expect(page.getByText('Round Leader',{exact:true})).toHaveCount(0);const next=page.getByRole('button',{name:'Next Auction Round',exact:true});await expect(next).toHaveCSS('animation-name','auction-next-step');await page.emulateMedia({reducedMotion:'reduce'});await expect(next).toHaveCSS('animation-name','none');await page.emulateMedia({reducedMotion:'no-preference'});await next.click()}
 }
 await expect(page.getByRole('heading',{name:'Winner Announced'})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.clock.runFor(1600);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await expectSettledPosition(page);
 await expectConsolidatedResults(page);await expect(page.locator('.auction-value-skeleton')).toHaveCount(6);await expect(page.getByRole('button',{name:'Finish & manage inventory'})).toBeDisabled();
 await page.clock.runFor(340);await expect(page.locator('.auction-value-skeleton')).toHaveCount(0);await expect(page.locator('.auction-result-metrics')).toHaveAttribute('aria-busy','true');
 const progress=await page.evaluate(()=>({market:document.querySelector('.auction-result-metrics dd')!.textContent,collection:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format([...document.querySelectorAll('.auction-collection-grid > button > strong')].reduce((sum,element)=>sum+Math.round(Number(element.textContent!.replace(/[^0-9.]/g,''))*100),0)/100)}));expect(progress.market).toBe(progress.collection);
 await expect(page.locator('.auction-collection .auction-known-value')).toContainText('Total Value');await expect(page.locator('.auction-known-value strong')).toHaveText(progress.market!);await expect(page.locator('.auction-collection')).not.toContainText('Net Profit / Loss');await page.locator('.auction-results').getByRole('button',{name:'Collection value explanation'}).click();await expect(page.getByRole('tooltip')).toContainText('frozen auction prices');await page.keyboard.press('Escape');
 const state=await saved(page);expect(progress.market).not.toBe(`$${(state.auction.result.value/100).toFixed(2)}`);
 for(const width of [1440,390,320])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await expectCollectionHeading(page);const collection=page.locator('.auction-collection');const skip=collection.getByRole('button',{name:'Skip Reveal'});await skip.scrollIntoViewIfNeeded();await expect(skip).toBeVisible();const centered=await collection.evaluate(element=>{const value=element.querySelector('.auction-known-value')!.getBoundingClientRect(),button=element.querySelector('.auction-reveal-controls button')!.getBoundingClientRect();return {right:button.left>=value.right,sameRow:Math.abs(value.y+value.height/2-button.y-button.height/2)<1}});expect(centered.right).toBe(true);expect(centered.sameRow).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-collection-heading').screenshot({path:testInfo.outputPath(`skip-reveal-heading-${width}-${theme}.png`)})}
 await page.getByRole('button',{name:'Skip Reveal'}).click();await expect(page.locator('.auction-collection-heading .auction-reveal-controls')).toHaveCount(0);await expect(page.locator('.auction-result-metrics')).toHaveAttribute('aria-busy','false');await expect(page.getByRole('button',{name:'Finish & manage inventory'})).toBeEnabled();
 await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Collection Market Value'})).toContainText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(state.auction.result.value/100));
});
test('auction purchase, sealed lock, settlement, persisted live inventory, sale, fee and reset make no per-round pricing calls',async({page})=>{
 let requests=0,multiplier=1;
 await fixtures(page);await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows.map(card=>({...card,marketPrice:card.marketPrice*multiplier})))})});
 await page.goto('/games');await page.getByRole('link',{name:/Riftbound Auction House/}).click();
 await expect(page).toHaveTitle('Riftbound Auction House | Raw Signal');await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House'})).toBeEnabled();
 await expect(page.locator('.auction-net-worth')).toHaveText('$2,500.00');
 await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const initial=await saved(page),copies=initial.auction.lot.length;
 await expect(page.locator('.auction-npcs')).not.toContainText('$');await expect(page.locator('.auction-card')).toHaveCount(copies);
 await expect(page.locator('.auction-card.is-hidden')).toHaveCount(copies-initial.auction.known.length);await expect(page.locator('.auction-net-worth')).toHaveCount(0);
 await expect(page.locator('.auction-offers .auction-clue-icon')).toHaveCount(3);
 const option=page.locator('.auction-offers button').first();await option.click();
 const afterBuy=await saved(page);expect(afterBuy.wallet.cash).toBe(250000-afterBuy.auction.spent);
 for(const button of await page.locator('.auction-offers button').all())await expect(button).toBeDisabled();
 await page.getByLabel('Bid (virtual USD)').fill(String(afterBuy.wallet.cash/100));await page.getByRole('button',{name:'Lock Bid',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Bid Locked/})).toBeVisible();await expect(page.getByLabel('Bid (virtual USD)')).toHaveCount(0);
 await page.clock.runFor(3500);await page.clock.runFor(2000);
 await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);await page.clock.runFor(5000);await expect(page.locator('.auction-card.is-hidden')).toHaveCount(0);
 const result=await saved(page);expect(result.auction.result.winner).toBe('You');expect(result.wallet.cash).toBe(0);
 await expect(page.getByText(/The cards you won have been added to your inventory/)).toBeVisible();const finish=await page.locator('.auction-results-heading').evaluate(element=>({right:element.getBoundingClientRect().right,button:element.querySelector('button')!.getBoundingClientRect().right}));expect(Math.abs(finish.right-finish.button)).toBeLessThan(1);
 expect(result.wallet.inventory.reduce((sum:number,row:{quantity:number})=>sum+row.quantity,0)).toBe(copies);
 expect(result.wallet.inventory.every((row:Record<string,unknown>)=>Object.keys(row).sort().join(',')==='printing,productId,quantity')).toBe(true);
 await expect(page.locator('.auction-card')).toHaveCount(copies);expect(requests).toBe(11);
 multiplier=2;await page.reload();await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await page.clock.runFor(5000);
 const reloaded=await saved(page);expect(reloaded.wallet.cash).toBe(0);expect(reloaded.wallet.inventory).toEqual(result.wallet.inventory);expect(reloaded.auction.lot).toEqual(result.auction.lot);
 await page.getByRole('button',{name:'Finish & manage inventory'}).click();
 await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'Sell All'}).click();
 await expect(page.getByRole('dialog',{name:'Sell All Priced Inventory?'})).toBeVisible();expect((await saved(page)).wallet.inventory.length).toBe(new Set(result.auction.lot.map((card:{productId:number;printing:string})=>`${card.productId}:${card.printing}`)).size);
 await page.getByRole('button',{name:'Confirm sale'}).click();expect((await saved(page)).wallet.inventory).toHaveLength(0);
 expect((await saved(page)).wallet.cash).toBe(result.wallet.inventory.reduce((total:number,holding:{productId:number;quantity:number})=>{const gross=(holding.productId-970000+1)*200*holding.quantity;return total+gross-Math.round(gross*.1)},0));
 await expect(page.locator('.auction-fee')).toHaveCount(0);await expect(page.getByLabel('Selling fee (%)')).toHaveCount(0);expect((await saved(page)).wallet.feeBps).toBe(1000);
 await page.getByRole('link',{name:'← Auction House',exact:true}).click();await page.getByRole('button',{name:'Reset cash & inventory'}).click();await expect(page.getByRole('dialog',{name:'Reset your auction progress?'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();expect((await saved(page)).wallet.cash).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Reset cash & inventory'}).click();await page.getByRole('button',{name:'Confirm reset'}).click();
 expect((await saved(page)).wallet).toEqual({cash:250000,feeBps:1000,inventory:[]});expect(requests).toBe(22);
});
test('unsubmitted bid expires after reload, can advance independently and cannot buy twice',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await startAuction(page);
 await page.locator('.auction-offers button').first().click();const bought=await saved(page);await page.reload();
 await expect(page.locator('.auction-offers button')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Investigation Results/})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(bought.wallet.cash);
 await page.clock.runFor(61000);const timed=await saved(page);expect(timed.auction.selected).toBe(0);
 expect(timed.wallet.cash).toBe(bought.wallet.cash);expect(timed.auction.stage).not.toBe('round');
 if(timed.auction.stage==='reveal'){await page.getByRole('button',{name:'Next auction round'}).click();expect((await saved(page)).auction.round).toBe(2);expect((await saved(page)).auction.selected).toBeNull();await expect(page.locator('.auction-clues li')).toHaveCount(1)}
});
test('auction layouts and artwork are usable in both themes at desktop and mobile widths',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1100});await page.goto('/games');await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  const tile=page.getByRole('link',{name:/Riftbound Auction House/});await expect(tile.locator('.game-tile-art')).toHaveClass(/is-loaded/);
  await page.screenshot({path:testInfo.outputPath(`auction-tile-${width}-${theme}.png`),fullPage:true});await tile.click();
  await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House'})).toBeEnabled();await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  expect(await page.locator('.auction-entry-card img').first().evaluate(element=>element.getBoundingClientRect().width)).toBeLessThanOrEqual(180);
  await startAuction(page);
  await expect(page.locator('.auction-offers button')).toHaveCount(3);
  for(const portrait of await page.locator('.auction-npcs .auction-bidder img').all()){await expect(portrait).toHaveCSS('width','40px');await expect(portrait).toHaveCSS('height','40px');}
  const layout=await page.locator('main.games-page').evaluate(element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return {left:rect.left,width:rect.width,padding:parseFloat(style.paddingLeft)}});
  expect(layout.left).toBe(0);expect(layout.width).toBe(width);expect(layout.padding).toBeGreaterThanOrEqual(16);
  const cards=await page.locator('.auction-collection-grid > .auction-card').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {width:rect.width,top:rect.top}}));
  expect(Math.max(...cards.map(card=>card.width))).toBeLessThanOrEqual(140);expect(cards.filter(card=>card.top===cards[0].top).length).toBeGreaterThanOrEqual(width===1440?9:2);
  await expect(page.locator('.auction-bid-divider')).toHaveCount(1);await expect(page.locator('.auction-bid-divider')).toBeVisible();await expect(page.locator('.auction-bid-divider')).toHaveCSS('border-top-width','1px');expect(await page.locator('.auction-npcs li').first().evaluate(element=>getComputedStyle(element,'::after').content)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/Inspect Auction Card/}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath(`auction-${width}-${theme}.png`),fullPage:true});
  await page.evaluate(key=>localStorage.removeItem(key),key);
 }
});
test('unpriced inventory stays owned and corrupted storage requires an explicit reset',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows.map((card,index)=>index===0?{...card,marketPrice:null}:card))}));
 await page.addInitScript(({key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,revision:0,sequence:0,wallet:{cash:10000,feeBps:1000,inventory:[{productId:970000,printing:'Normal',quantity:2},{productId:970001,printing:'Normal',quantity:1}]},auction:null}))},{key});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter Bilgewater Auction House'})).toBeEnabled();
 await expect(page.locator('.auction-net-worth')).toHaveText('N/A');await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).click();await expect(page.locator('.auction-owned-card').filter({hasText:'Auction Card 1'})).toContainText('N/A');
 await page.getByRole('button',{name:'Sell All'}).click();await page.getByRole('button',{name:'Confirm sale'}).click();expect((await saved(page)).wallet.inventory).toEqual([{productId:970000,printing:'Normal',quantity:2}]);
 await page.evaluate(key=>localStorage.setItem(key,'broken'),key);await page.goto('/games/riftbound-auction?corrupt=1');
 await expect(page.getByRole('alert')).toContainText('has not been overwritten');
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('broken');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Reset saved game'}).click();await expect(page.locator('.auction-net-worth')).toContainText('$2,500.00');
});

test('new lots skip missing, broken and placeholder images before starting the clock',async({page})=>{
 await fixtures(page);
 const cards=rows.map((card,index)=>({...card,image:index===0?'':`https://tcgplayer-cdn.tcgplayer.com/product/${index}.jpg`}));
 await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(cards)}));
 await page.route('https://tcgplayer-cdn.tcgplayer.com/**',route=>{
  const id=Number(route.request().url().split('/').at(-1)!.split('.')[0]);
  if(id===1)return route.fulfill({status:404,body:'Missing'});
  return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${id===2?285:280}"/>`});
 });
 await page.goto('/games/riftbound-auction');await startAuction(page);
 await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const state=await saved(page);expect(state.auction.lot.every((card:{productId:number})=>card.productId>970002)).toBe(true);
 expect(state.wallet.cash).toBe(250000);expect(state.auction.deadline-state.auction.npcs[0].lockAt).toBeLessThan(60000);
 await expect(page.locator('.auction-card.is-hidden').first()).not.toHaveAttribute('data-rarity');
 expect(await page.locator('.auction-back-art b').first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(30);
});

test('mute persists, countdown warns, Enter locks and reduced motion reveals immediately',async({page})=>{
 await fixtures(page);await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Mute Sound'}).click();await expect(page.getByRole('button',{name:'Enable Sound'})).toHaveAttribute('aria-pressed','true');
 await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 await page.clock.runFor(51000);await expect(page.getByRole('timer')).toHaveClass(/is-urgent/);await expect(page.getByRole('timer')).toHaveCSS('animation-name','none');
 await page.getByLabel('Bid (virtual USD)').fill('2500');await page.getByLabel('Bid (virtual USD)').press('Enter');
 await page.clock.runFor(3500);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();
 await expect(page.locator('.auction-card.is-hidden')).toHaveCount(0);await expect(page.getByRole('button',{name:'Skip Reveal'})).toHaveCount(0);
 await expect(page.locator('.auction-bid-history .auction-history-cell[data-completed="true"]')).toHaveCount(4);
 const state=await saved(page);const total=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(state.auction.result.value/100);await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Collection Market Value'}).locator('dd')).toHaveText(total);await expect(page.locator('.auction-collection .auction-known-value strong')).toHaveText(total);
 await page.reload();await expect(page.getByRole('button',{name:'Enable Sound'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Enable Sound'}).click();await page.reload();await expect(page.getByRole('button',{name:'Mute Sound'})).toBeVisible();
 await page.evaluate(()=>{const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();document.documentElement.dataset.auctionAudio='ready'}}});
 await page.getByRole('button',{name:/Inspect Auction Card/}).first().click();await expect(page.locator('html')).toHaveAttribute('data-auction-audio','ready');
});

test('winner preview, confetti, four-round notes matrix and full-width colored results remain accessible',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 await expect(page.locator('.auction-title-row').getByRole('button',{name:'Mute Sound',exact:true})).toBeVisible();await expect(page.getByText('Virtual Trading · Saved in This Browser')).toHaveCount(0);
 await expect(page.locator('.auction-bid-history')).toHaveCount(0);
 await page.locator('.auction-offers button').first().click();const clue=(await saved(page)).auction.clues[0];
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.getByLabel('Bid (virtual USD)').fill('100');await page.getByLabel('Bid (virtual USD)').press('Enter');await expect(page.locator('.auction-npcs li.is-locked')).toHaveCount(4);
 await page.clock.runFor(250);await expect(page.getByRole('heading',{name:'Winner Announced'})).toBeVisible();await expect(page.locator('.auction-confetti i')).toHaveCount(40);await expect(page.getByRole('heading',{name:'Auction Settled'})).toHaveCount(0);await expect(page.locator('.auction-collection')).toHaveCount(0);
 const settled=await saved(page);await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.clock.runFor(1800);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await expectSettledPosition(page);await finishReveal(page);
 const resultWidth=await page.locator('.auction-results').evaluate(element=>element.getBoundingClientRect().width),collectionWidth=await page.locator('.auction-collection').evaluate(element=>element.getBoundingClientRect().width);expect(Math.abs(resultWidth-collectionWidth)).toBeLessThan(2);
 await expect(page.locator('.auction-result-metrics .is-gain')).not.toHaveCount(0);await expect(page.locator('.auction-result-metrics .is-cost')).toHaveCount(2);
 await expect(page.locator('.auction-history-table .is-pending')).toHaveCount(12);await expect(page.locator('.auction-history-table .is-winning')).toHaveCount(1);
 const playerBid=page.locator('.auction-history-table tbody tr').first().locator('button').first();await playerBid.hover();await expect(page.getByRole('tooltip')).toContainText(investigationDescription(clue.text));await expect(playerBid).toHaveClass(/is-inspected/);await page.keyboard.press('Escape');await expect(page.locator('.auction-bid-popup')).toHaveCount(0);
 const npcBid=page.locator('.auction-history-table tbody tr').nth(1).locator('button').first();await npcBid.focus();const npcFinding=settled.auction.npcs[0].findings.at(-1);await expect(page.getByRole('tooltip')).toContainText(INVESTIGATIONS.find(option=>option.id===settled.auction.npcs[0].investigations.at(-1))!.label);await expect(page.getByRole('tooltip')).toContainText(investigationDescription(npcFinding.text));await page.keyboard.press('Escape');
 await expect(page.locator('.auction-results .auction-bid-history')).toHaveCount(1);await expect(page.locator('section.auction-bid-history')).toHaveCount(0);
 await expect(page.locator('.auction-finish')).toHaveCSS('animation-name','auction-next-step');expect((await saved(page)).wallet).toEqual(settled.wallet);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`auction-results-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-finish')).toHaveCSS('animation-name','none');await page.setViewportSize({width:390,height:1000});await playerBid.tap();await expect(page.locator('.auction-bid-popup')).toBeVisible();await page.getByRole('heading',{name:'Bid History'}).tap();await expect(page.locator('.auction-bid-popup')).toHaveCount(0);
});

test('investigation results replace offers, controls align, neutral metrics and centered reset work',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});const boxes=await page.locator('.auction-bid-form input,.auction-bid-form button').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom}}));expect(Math.max(...boxes.map(box=>box.top))-Math.min(...boxes.map(box=>box.top))).toBeLessThan(1);expect(Math.max(...boxes.map(box=>box.bottom))-Math.min(...boxes.map(box=>box.bottom))).toBeLessThan(1);
  if(width===1440){const heights=await page.locator('.auction-investigate,.auction-bidding').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));expect(Math.abs(heights[0]-heights[1])).toBeLessThan(1)}
 }
 await expect(page.locator('.auction-npcs .auction-bid-status').first()).toHaveCSS('animation-name','auction-awaiting-bid');await expect(page.locator('.auction-collection-grid > .auction-card').nth(0)).not.toHaveClass(/is-hidden/);await expect(page.locator('.auction-collection-grid > .auction-card').nth(1)).not.toHaveClass(/is-hidden/);
 await page.locator('.auction-offers button').first().click();await expect(page.getByRole('heading',{name:/Investigation Results/})).toBeVisible();await expect(page.locator('.auction-offers')).toHaveCount(0);await expect(page.locator('.auction-collection .auction-clues')).toHaveCount(0);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:testInfo.outputPath(`auction-investigate-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.getByLabel('Bid (virtual USD)').fill('2000');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(3500);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);await expect(page.getByText(/Modeled Selling Fee/)).toHaveCount(0);await page.getByRole('button',{name:'Finish & manage inventory'}).click();await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name:'Inventory',exact:true}).click();await expect(page.locator('.auction-owned-card').first()).toHaveAttribute('data-rarity',/common|rare/);
 await page.getByRole('link',{name:'← Auction House',exact:true}).click();await page.getByRole('button',{name:'Reset cash & inventory'}).click();const rect=await page.getByRole('dialog').boundingBox();expect(Math.abs(rect!.x+rect!.width/2-390/2)).toBeLessThan(1);expect(Math.abs(rect!.y+rect!.height/2-1000/2)).toBeLessThan(1);await page.getByRole('button',{name:'Confirm reset'}).click();
 await startAuction(page);await page.getByLabel('Bid (virtual USD)').fill('2000');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(3500);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);const spend=page.locator('.auction-result-metrics > div').filter({hasText:'Your Investigation Spend'});await expect(spend).toContainText('$0.00');await expect(spend).not.toHaveClass(/is-cost|is-loss/);await spend.hover();
 const blue=await spend.evaluate(element=>{const probe=document.createElement('span');probe.style.color='var(--blue)';element.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color});await expect(spend).toHaveCSS('border-top-color',blue);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-finish')).toHaveCSS('animation-name','none');
});

test('no early buyout has full-width round review and an NPC win has no player confetti',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await startAuction(page);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const force=async(bids:number[])=>page.evaluate(({key,bids})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,bid:bids[index],locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,bids});
 await force([100,100,100]);await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(250);await expect(page.getByRole('heading',{name:'Round Bids',exact:true})).toBeVisible();await expect(page.locator('.auction-no-buyout')).toContainText('No Early Buyout');await expect(page.getByText(/Previous bids expire/)).toHaveCount(0);await expect(page.locator('.auction-results .auction-history-table button')).toHaveCount(4);await expect(page.locator('section.auction-bid-history')).toHaveCount(0);
 expect(await page.locator('.auction-results').evaluate(element=>element.getBoundingClientRect().width)).toBe(await page.locator('.auction-collection').evaluate(element=>element.getBoundingClientRect().width));
 await page.getByRole('button',{name:'Next auction round'}).click();await force([10000,4000,3000]);await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(250);await expect(page.getByRole('heading',{name:'Winner Announced'})).toBeVisible();await expect(page.locator('.auction-confetti')).toHaveCount(0);await page.clock.runFor(1800);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);await expect(page.getByText(/Your losing bid was not charged/)).toHaveCount(0);expect((await saved(page)).wallet.cash).toBe(250000);await expect(page.locator('.auction-history-table button')).toHaveCount(8);
});
