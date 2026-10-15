import {expect,test,type Page} from '@playwright/test';
import {INVESTIGATIONS} from '../../core/domain/auction-information';
import {AUCTION_NPCS} from '../../core/domain/auction-npcs';
test.use({hasTouch:true});

const key='raw-signal-auction-house-v1';
const rows=Array.from({length:24},(_,index)=>({game:'riftbound',productId:970000+index,name:`Auction Card ${index+1}`,image:`https://images.example/auction/${index}.svg`,marketPrice:index+1,printing:'Normal',section:'rares',set:'Origins',year:2025,number:String(index),rarity:index<12?'Common':'Rare',url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
async function fixtures(page:Page){
 await page.addInitScript(()=>Object.defineProperty(crypto,'getRandomValues',{value:(array:Uint32Array)=>{array[0]=42;return array}}));
 await page.route('https://images.example/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
 await page.clock.install({time:new Date('2026-10-14T12:00:00Z')});
}
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);

test('new rivals have original portraits, distinct visible strategies and resumable seats',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter Free Auction',exact:true}).click();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const profiles=AUCTION_NPCS.filter(npc=>['The Archivist','The Playset Builder','The Skeptic'].includes(npc.name));
 await page.evaluate(({key,names})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,name:names[index]}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,names:profiles.map(npc=>npc.name)});
 for(const npc of profiles){const identity=page.locator('.auction-npcs .auction-bidder-identity').filter({hasText:npc.name});await expect(identity).toContainText(npc.strategy);await expect(identity.locator('img')).toHaveAttribute('src',`/images/games/auction-${npc.portrait}.webp`);await expect.poll(()=>identity.locator('img').evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(192)}
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-bidding').screenshot({path:testInfo.outputPath(`new-rivals-${width}-${theme}.png`)})}
 await page.reload();for(const npc of profiles)await expect(page.locator('.auction-npcs')).toContainText(npc.name);
});

test('investigation icons use target rarity or general clue tier colors and offers have heading space',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter Free Auction',exact:true}).click();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const targets:Record<string,string>={common3:'common',uncommon3:'uncommon',rare2:'rare','rare-mark2':'rare','rare-identity2':'rare',rares:'rare',epic2:'epic','epic-mark2':'epic','epic-identity2':'epic',alt1:'epic','alt-mark1':'epic',chase1:'premium','chase-mark1':'premium','chase-identity1':'premium'};
 const tierTones={basic:'common',targeted:'rare',strong:'epic',premium:'premium'},tokens={common:'--gray',uncommon:'--tone-up',rare:'--blue',epic:'--purple',premium:'--tone-favorite'};
 const options=INVESTIGATIONS.filter(option=>option.id!=='count');
 for(const width of [1440,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(let offset=0;offset<options.length;offset+=3){const batch=options.slice(offset,offset+3);await page.evaluate(({key,offers})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=offers;state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,offers:batch});
   for(const [index,option] of batch.entries()){const tone=targets[option.id]??tierTones[option.tier],icon=page.locator('.auction-offers .auction-clue-icon').nth(index);await expect(icon).toHaveAttribute('data-tone',tone);const expected=await icon.evaluate((element,token)=>{const probe=document.createElement('span');probe.style.color=`var(${token})`;element.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color},tokens[tone as keyof typeof tokens]);await expect(icon).toHaveCSS('color',expected);await expect(icon).toHaveAttribute('aria-hidden','true')}
  }
  const space=await page.locator('.auction-investigate').evaluate(element=>element.querySelector('.auction-offers')!.getBoundingClientRect().top-element.querySelector('h2')!.getBoundingClientRect().bottom);expect(space).toBeGreaterThanOrEqual(24);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-investigate').screenshot({path:testInfo.outputPath(`clue-colors-${width}-${theme}.png`)});
 }
});

test('rarity-only investigations keep identities and prices hidden and the paid entry text has no separate background',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');
 const paidText=page.locator('.auction-entry-card.is-premium > span');await expect(paidText).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 for(const color of ['dark','light']){await page.evaluate(color=>document.documentElement.dataset.theme=color,color);for(const entry of await page.locator('.auction-entry-card').all()){await entry.hover();const caption=entry.locator(':scope > span');for(const side of ['top','right','bottom','left'])await expect(caption).toHaveCSS(`border-${side}-width`,'0px');await expect(caption).toHaveCSS('box-shadow','none');await expect(caption).toHaveCSS('background-color','rgba(0, 0, 0, 0)')}}
 await page.getByRole('button',{name:'Enter Free Auction',exact:true}).click();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const before=await saved(page),option=INVESTIGATIONS.find(option=>option.id==='rarity-peek3')!;
 await page.evaluate(({key,option})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.offers=[option];state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,option});
 await page.getByRole('button',{name:/Rarity Peek/}).click();await expect(page.locator('.auction-rarity-marker')).toHaveCount(3);
 const after=await saved(page);expect(after.auction.known).toEqual(before.auction.known);expect(after.auction.priced).toEqual(before.auction.priced);expect(after.wallet.cash).toBe(before.wallet.cash-option.cost);
 const marked=page.locator('.auction-card.is-hidden[data-rarity]');await expect(marked).toHaveCount(3);await expect(marked.locator('strong')).toHaveCount(0);await expect(marked.first()).not.toContainText(/Auction Card|\$/);await expect(marked.first().locator('img')).toHaveAttribute('src','/images/games/riftbound-card-back.webp');
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`rarity-markers-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
});
test('collection themes and rival strategy labels remain visible and stable after reload without extra data calls',async({page},testInfo)=>{
 await fixtures(page);let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter Free Auction',exact:true}).click();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();
 const before=await saved(page),theme=page.locator('.auction-lot-theme');await expect(theme).toBeVisible();await expect(theme).toContainText('not guaranteed contents or value');
 const label=await theme.locator('strong').textContent();await expect(page.locator('.auction-bidder-identity > small')).toHaveCount(3);const strategies=await page.locator('.auction-bidder-identity > small').allTextContents();expect(new Set(strategies).size).toBe(3);expect(requests).toBe(11);
 for(const width of [1440,390])for(const color of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(color=>document.documentElement.dataset.theme=color,color);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.auction-bidding').screenshot({path:testInfo.outputPath(`strategies-${width}-${color}.png`)});await theme.screenshot({path:testInfo.outputPath(`theme-${width}-${color}.png`)})}
 await page.reload();await expect(page.getByLabel('Bid (virtual USD)')).toBeVisible();await expect(theme.locator('strong')).toHaveText(label!);expect(await page.locator('.auction-bidder-identity > small').allTextContents()).toEqual(strategies);expect((await saved(page)).auction.lot).toEqual(before.auction.lot);expect(requests).toBe(22);
});
async function finishReveal(page:Page){const skip=page.getByRole('button',{name:'Skip Reveal'});if(await skip.count())await skip.click();await expect(page.getByRole('button',{name:'Finish & manage inventory'})).toBeEnabled();const prices=await page.locator('.auction-collection-grid > button > strong').allTextContents();const values=prices.map(price=>Number(price.replace(/[^0-9.]/g,'')));expect(values.every((value,index)=>index===0||values[index-1]>=value)).toBe(true)}
async function expectSettledPosition(page:Page){const top=await page.locator('#auction-settled').evaluate(element=>element.getBoundingClientRect().top);expect(top).toBeGreaterThanOrEqual(124);expect(top).toBeLessThanOrEqual(126)}
async function expectConsolidatedResults(page:Page){await expect(page.getByRole('timer')).toHaveText('Auction Finished');await expect(page.locator('.auction-result-metrics > div')).toHaveCount(6);await expect(page.getByText('Gross Market Spread',{exact:true})).toHaveCount(0)}

test('entry artwork loads and broken card artwork rerolls automatically with text-only starting status',async({page})=>{
 await fixtures(page);const cards=Array.from({length:90},(_,index)=>({...rows[index%24],productId:980000+index,name:`Entry Card ${index}`,image:`https://images.example/entry/${index}.svg`,marketPrice:1+index/10}));
 const failed=new Set<string>();let probes=0;await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(cards)}));
 await page.route('https://images.example/**',async route=>{await new Promise(resolve=>setTimeout(resolve,60));if(probes++<20){failed.add(route.request().url());return route.fulfill({status:404,body:'Missing'})}return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'})});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter Free Auction',exact:true})).toBeEnabled();await expect(page.locator('.auction-entry-card img')).toHaveCount(2);await expect.poll(()=>page.locator('.auction-entry-card img').evaluateAll(elements=>elements.every(element=>(element as HTMLImageElement).naturalWidth>0))).toBe(true);
 await page.getByRole('button',{name:'Enter Free Auction',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Starting Auction…'})).toBeVisible();await expect(page.locator('.auction-lobby .detail-skeleton')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const state=await saved(page);expect(state.wallet.cash).toBe(250000);expect(state.auction.lot.every((card:{image:string})=>!failed.has(card.image))).toBe(true);await expect(page.getByText(/Not enough cards with working artwork/)).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('paid entry charges $50 once after artwork checks, offers larger collections, and uses accessible pulsing entry controls',async({page},testInfo)=>{
 await fixtures(page);let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});await page.goto('/games/riftbound-auction');
 const free=page.getByRole('button',{name:'Enter Free Auction',exact:true}),paid=page.getByRole('button',{name:'Enter Paid Auction · $50',exact:true});await expect(free).toBeEnabled();await expect(paid).toBeEnabled();await expect(free).toContainText('25–90 cards');await expect(paid).toContainText('50–130 cards');await expect(free).toHaveCSS('animation-name','auction-entry-pulse');await expect(paid).toHaveCSS('animation-name','auction-entry-pulse');await page.emulateMedia({reducedMotion:'reduce'});await expect(paid).toHaveCSS('animation-name','none');
 await paid.click();await expect(page.locator('.auction-lobby .detail-skeleton')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();let state=await saved(page);expect(state.wallet.cash).toBe(245000);expect(state.auction.kind).toBe('paid');expect(state.auction.lot.length).toBeGreaterThanOrEqual(50);expect(state.auction.lot.length).toBeLessThanOrEqual(130);expect(state.auction.deadline-state.auction.npcs[0].lockAt).toBeLessThan(60000);await expect(page.locator('.auction-round-header')).toHaveClass(/detail-section/);await expect(page.getByRole('link',{name:/Jump to Bid/})).toHaveCount(0);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`paid-auction-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.reload();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();expect((await saved(page)).wallet.cash).toBe(245000);
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.getByLabel('Bid (virtual USD)').fill('2450');await page.getByLabel('Bid (virtual USD)').press('Enter');await page.clock.runFor(250);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await expectConsolidatedResults(page);state=await saved(page);expect(state.wallet.cash).toBe(0);await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Auction Entry Fee'})).toContainText('-$50.00');await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Selling Fee'}).locator('dd')).toHaveText(/^-/);expect(requests).toBe(22);
});

test('rarity inventory sales confirm precise proceeds and lobby facts and timing tooltip work across themes',async({page},testInfo)=>{
 await fixtures(page);let requests=0;await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)})});
 await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({version:1,revision:0,sequence:0,auction:null,wallet:{cash:250000,feeBps:1000,inventory:[{productId:970000,printing:'Normal',quantity:3},{productId:970012,printing:'Normal',quantity:2},{productId:999,printing:'Normal',quantity:1}]}})),{key});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Enter Free Auction',exact:true})).toBeVisible();await page.getByRole('button',{name:'Auction timing and preparation'}).click();await expect(page.getByRole('tooltip')).toContainText('Background tabs and reloads do not pause');await page.keyboard.press('Escape');
 await page.locator('.auction-inventory summary').click();await expect(page.getByRole('button',{name:'Sell Commons',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sell Rares',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sell Uncommons',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Sell All',exact:true})).toBeEnabled();
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`auction-lobby-sales-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.getByRole('button',{name:'Sell Commons',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sell Commons?'})).toContainText('$2.70');await page.getByRole('button',{name:'Close',exact:true}).click();expect((await saved(page)).wallet.inventory).toHaveLength(3);
 await page.getByRole('button',{name:'Sell Commons',exact:true}).click();await page.getByRole('button',{name:'Confirm sale'}).click();const sold=await saved(page);expect(sold.wallet.cash).toBe(250270);expect(sold.wallet.inventory.map((row:{productId:number})=>row.productId)).toEqual([970012,999]);await expect(page.getByRole('button',{name:'Sell Commons',exact:true})).toBeDisabled();expect(requests).toBe(11);
});

test('NPC overpayment shares its loss, credits once, and shows the player net result after expenses',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();await page.locator('.auction-offers button').first().click();
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,bid:index===0?250000:1,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.getByRole('button',{name:'Pass ($0)'}).click();await page.clock.runFor(250);await page.clock.runFor(1800);await finishReveal(page);
 const state=await saved(page),result=state.auction.result,share=result.lossShares.find((row:{name:string})=>row.name==='You').cents;expect(result.net).toBeLessThan(0);expect(result.lossShares.reduce((sum:number,row:{cents:number})=>sum+row.cents,0)).toBe(-result.net);expect(state.wallet.cash).toBe(250000-result.playerExpenses+share);expect(state.wallet.inventory).toHaveLength(0);
 await expect(page.getByRole('heading',{name:'NPC Loss Shared'})).toBeVisible();await expect(page.locator('.auction-loss-shares li')).toHaveCount(3);await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Your Auction Result'})).toContainText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((share-result.playerExpenses)/100));await expect(page.locator('.auction-loss-expand')).toHaveCSS('animation-name','auction-loss-expand');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-loss-expand')).toHaveCSS('animation-name','none');
 await page.reload();await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);expect((await saved(page)).wallet.cash).toBe(state.wallet.cash);await page.getByRole('button',{name:'Finish & manage inventory'}).click();expect((await saved(page)).wallet.cash).toBe(state.wallet.cash);
});

test('settlement skeletons count alongside revealed cards and previous bids stay public-only through rounds two to four',async({page},testInfo)=>{
 await fixtures(page);await page.clock.pauseAt(new Date('2026-10-14T12:00:05Z'));await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const boxes=await page.locator('.auction-offers button').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().toJSON()));expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);expect(boxes[2].top).toBeGreaterThanOrEqual(boxes[1].bottom);
 for(let round=1;round<=4;round++){
  await expect(page.locator('.auction-shared-reveal')).toContainText(`Round ${round} Shared Reveal`);
  await expect(page.locator('.auction-previous-bids')).toHaveCount(round===1?0:4);
  await expect(page.locator('.auction-previous-bids > small')).toHaveCount(0);await expect(page.locator('.auction-previous-bids .is-round-leader')).toHaveCount(round-1);
  await expect(page.locator('.auction-prior-bid')).toHaveCount((round-1)*4);await expect(page.getByText('Previous Bids',{exact:true})).toHaveCount(0);
  if(round>1){for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const positions=await page.locator('.auction-npcs li').first().evaluate(element=>{const status=element.querySelector('.auction-bid-status')!.getBoundingClientRect(),previous=element.querySelector('.auction-previous-bids')!.getBoundingClientRect();return {statusRight:status.right,previousLeft:previous.left}});expect(positions.previousLeft).toBeGreaterThan(positions.statusRight);await expect(page.locator('.auction-previous-bids').first().locator('strong')).toHaveCount(round-1)}await page.screenshot({path:testInfo.outputPath(`previous-bids-round-${round}.png`),fullPage:true,animations:'disabled'})}
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
  await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByLabel('Bid (virtual USD)').press('Enter');await page.clock.runFor(250);
  if(round<4){await expect(page.getByRole('heading',{name:'Round Bids',exact:true})).toBeVisible();await expect(page.getByText('Round Leader',{exact:true})).toHaveCount(0);const next=page.getByRole('button',{name:'Next Auction Round',exact:true});await expect(next).toHaveCSS('animation-name','auction-next-step');await page.emulateMedia({reducedMotion:'reduce'});await expect(next).toHaveCSS('animation-name','none');await page.emulateMedia({reducedMotion:'no-preference'});await next.click()}
 }
 await expect(page.getByRole('heading',{name:'Winner Announced'})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.clock.runFor(1600);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await expectSettledPosition(page);
 await expectConsolidatedResults(page);await expect(page.locator('.auction-value-skeleton')).toHaveCount(6);await expect(page.getByRole('button',{name:'Finish & manage inventory'})).toBeDisabled();
 await page.clock.runFor(340);await expect(page.locator('.auction-value-skeleton')).toHaveCount(0);await expect(page.locator('.auction-result-metrics')).toHaveAttribute('aria-busy','true');
 const progress=await page.evaluate(()=>({market:document.querySelector('.auction-result-metrics dd')!.textContent,collection:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format([...document.querySelectorAll('.auction-collection-grid > button > strong')].reduce((sum,element)=>sum+Math.round(Number(element.textContent!.replace(/[^0-9.]/g,''))*100),0)/100)}));expect(progress.market).toBe(progress.collection);
 await expect(page.locator('.auction-collection .auction-known-value')).toHaveCount(0);await expect(page.locator('.auction-collection')).not.toContainText('Net Profit / Loss');await expect(page.locator('.auction-collection').getByRole('button',{name:'Collection value explanation'})).toHaveCount(0);await page.locator('.auction-results').getByRole('button',{name:'Collection value explanation'}).click();await expect(page.getByRole('tooltip')).toContainText('frozen auction prices');await page.keyboard.press('Escape');
 const state=await saved(page);expect(progress.market).not.toBe(`$${(state.auction.result.value/100).toFixed(2)}`);
 for(const width of [1440,390,320])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const heading=page.locator('.auction-collection-heading');await heading.locator('h2').click();await expect(heading.getByRole('button',{name:'Skip Reveal'})).toBeVisible();const centers=await heading.evaluate(element=>{const center=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}};return {row:center(element),button:center(element.querySelector('button')!),title:center(element.querySelector('h2')!),count:center(element.querySelector('.auction-copy-count')!)}});expect(Math.abs(centers.row.x-centers.button.x)).toBeLessThan(1);expect(Math.abs(centers.title.y-centers.button.y)).toBeLessThan(1);expect(Math.abs(centers.count.y-centers.button.y)).toBeLessThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await heading.screenshot({path:testInfo.outputPath(`skip-reveal-heading-${width}-${theme}.png`)})}
 await page.getByRole('button',{name:'Skip Reveal'}).click();await expect(page.locator('.auction-collection-heading .auction-reveal-controls')).toHaveCount(0);await expect(page.locator('.auction-result-metrics')).toHaveAttribute('aria-busy','false');await expect(page.getByRole('button',{name:'Finish & manage inventory'})).toBeEnabled();
 await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Collection Market Value'})).toContainText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(state.auction.result.value/100));
});
test('auction purchase, sealed lock, settlement, persisted live inventory, sale, fee and reset make no per-round pricing calls',async({page})=>{
 let requests=0,multiplier=1;
 await fixtures(page);await page.route('**/data/*.json',route=>{requests++;return route.fulfill({contentType:'application/json',body:JSON.stringify(rows.map(card=>({...card,marketPrice:card.marketPrice*multiplier})))})});
 await page.goto('/games');await page.getByRole('link',{name:/Riftbound Auction House/}).click();
 await expect(page).toHaveTitle('Riftbound Auction House | Raw Signal');await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();
 await expect(page.locator('.auction-net-worth')).toContainText('$2,500.00 + ($0.00 cards)');
 await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const initial=await saved(page),copies=initial.auction.lot.length;
 await expect(page.locator('.auction-npcs')).not.toContainText('$');await expect(page.locator('.auction-card')).toHaveCount(copies);
 await expect(page.locator('.auction-card.is-hidden')).toHaveCount(copies-2);await expect(page.locator('.auction-net-worth')).toHaveCount(0);
 await expect(page.locator('.auction-offers .auction-clue-icon')).toHaveCount(3);
 const option=page.locator('.auction-offers button').first();await option.click();
 const afterBuy=await saved(page);expect(afterBuy.wallet.cash).toBe(250000-afterBuy.auction.spent);
 for(const button of await page.locator('.auction-offers button').all())await expect(button).toBeDisabled();
 await page.getByLabel('Bid (virtual USD)').fill(String(afterBuy.wallet.cash/100));await page.getByRole('button',{name:'Lock Bid',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Bid Locked/})).toBeVisible();await expect(page.getByLabel('Bid (virtual USD)')).toHaveCount(0);
 await page.clock.runFor(3500);await page.clock.runFor(2000);
 await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);await page.clock.runFor(5000);await expect(page.locator('.auction-card.is-hidden')).toHaveCount(0);
 const result=await saved(page);expect(result.auction.result.winner).toBe('You');expect(result.wallet.cash).toBe(0);
 await expect(page.getByText(/The cards you won have been added to your inventory/)).toBeVisible();const finish=await page.locator('.auction-finish-actions').evaluate(element=>({right:element.getBoundingClientRect().right,button:element.querySelector('button')!.getBoundingClientRect().right}));expect(Math.abs(finish.right-finish.button)).toBeLessThan(1);
 expect(result.wallet.inventory.reduce((sum:number,row:{quantity:number})=>sum+row.quantity,0)).toBe(copies);
 expect(result.wallet.inventory.every((row:Record<string,unknown>)=>Object.keys(row).sort().join(',')==='printing,productId,quantity')).toBe(true);
 await expect(page.locator('.auction-card')).toHaveCount(copies);expect(requests).toBe(11);
 multiplier=2;await page.reload();await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await page.clock.runFor(5000);
 const reloaded=await saved(page);expect(reloaded.wallet.cash).toBe(0);expect(reloaded.wallet.inventory).toEqual(result.wallet.inventory);expect(reloaded.auction.lot).toEqual(result.auction.lot);
 await page.getByRole('button',{name:'Finish & manage inventory'}).click();
 await page.locator('.auction-inventory summary').click();await page.getByRole('button',{name:'Sell All'}).click();
 await expect(page.getByRole('dialog',{name:'Sell All Priced Inventory?'})).toBeVisible();expect((await saved(page)).wallet.inventory.length).toBe(new Set(result.auction.lot.map((card:{productId:number;printing:string})=>`${card.productId}:${card.printing}`)).size);
 await page.getByRole('button',{name:'Confirm sale'}).click();expect((await saved(page)).wallet.inventory).toHaveLength(0);
 expect((await saved(page)).wallet.cash).toBe(result.wallet.inventory.reduce((total:number,holding:{productId:number;quantity:number})=>{const gross=(holding.productId-970000+1)*200*holding.quantity;return total+gross-Math.round(gross*.1)},0));
 await page.locator('.auction-fee summary').click();await page.getByLabel('Selling fee (%)').fill('15');await page.getByRole('button',{name:'Apply fee'}).click();expect((await saved(page)).wallet.feeBps).toBe(1500);
 await page.getByRole('button',{name:'Reset cash & inventory'}).click();await expect(page.getByRole('dialog',{name:'Reset your auction progress?'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();expect((await saved(page)).wallet.cash).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Reset cash & inventory'}).click();await page.getByRole('button',{name:'Confirm reset'}).click();
 expect((await saved(page)).wallet).toEqual({cash:250000,feeBps:1000,inventory:[]});expect(requests).toBe(22);
});
test('unsubmitted bid expires after reload, can advance independently and cannot buy twice',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();
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
  await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  expect(await page.locator('.auction-entry-card img').first().evaluate(element=>element.getBoundingClientRect().width)).toBeLessThanOrEqual(180);
  await page.getByRole('button',{name:'Enter free auction'}).click();
  await expect(page.locator('.auction-offers button')).toHaveCount(3);
  const layout=await page.locator('main.games-page').evaluate(element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return {left:rect.left,width:rect.width,padding:parseFloat(style.paddingLeft)}});
  expect(layout.left).toBe(0);expect(layout.width).toBe(width);expect(layout.padding).toBeGreaterThanOrEqual(16);
  const cards=await page.locator('.auction-collection-grid > .auction-card').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {width:rect.width,top:rect.top}}));
  expect(Math.max(...cards.map(card=>card.width))).toBeLessThanOrEqual(140);expect(cards.filter(card=>card.top===cards[0].top).length).toBeGreaterThanOrEqual(width===1440?9:2);
  await expect(page.locator('.auction-bid-divider')).toBeVisible();await expect(page.locator('.auction-bid-divider')).toHaveCSS('border-top-width','1px');expect(await page.locator('.auction-npcs li').first().evaluate(element=>getComputedStyle(element,'::after').height)).toBe('1px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/Inspect Auction Card/}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath(`auction-${width}-${theme}.png`),fullPage:true});
  await page.evaluate(key=>localStorage.removeItem(key),key);
 }
});
test('unpriced inventory stays owned and corrupted storage requires an explicit reset',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows.map((card,index)=>index===0?{...card,marketPrice:null}:card))}));
 await page.addInitScript(({key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,revision:0,sequence:0,wallet:{cash:10000,feeBps:1000,inventory:[{productId:970000,printing:'Normal',quantity:2},{productId:970001,printing:'Normal',quantity:1}]},auction:null}))},{key});
 await page.goto('/games/riftbound-auction');await expect(page.getByRole('button',{name:'Enter free auction'})).toBeEnabled();
 await expect(page.locator('.auction-net-worth')).toContainText('N/A cards');await page.locator('.auction-inventory summary').click();await expect(page.locator('.auction-owned-card').first()).toContainText('Auction Card 1');
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
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();
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
 await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 await page.clock.runFor(51000);await expect(page.getByRole('timer')).toHaveClass(/is-urgent/);await expect(page.getByRole('timer')).toHaveCSS('animation-name','none');
 await page.getByLabel('Bid (virtual USD)').fill('2500');await page.getByLabel('Bid (virtual USD)').press('Enter');
 await page.clock.runFor(3500);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();
 await expect(page.locator('.auction-card.is-hidden')).toHaveCount(0);await expect(page.getByRole('button',{name:'Skip Reveal'})).toHaveCount(0);
 await expect(page.locator('.auction-bid-history .auction-history-cell[data-completed="true"]')).toHaveCount(4);
 const state=await saved(page);await expect(page.locator('.auction-result-metrics > div').filter({hasText:'Collection Market Value'}).locator('dd')).toHaveText(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(state.auction.result.value/100));await expect(page.locator('.auction-collection .auction-known-value')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Enable Sound'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Enable Sound'}).click();await page.reload();await expect(page.getByRole('button',{name:'Mute Sound'})).toBeVisible();
 await page.evaluate(()=>{const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();document.documentElement.dataset.auctionAudio='ready'}}});
 await page.getByRole('button',{name:/Inspect Auction Card/}).first().click();await expect(page.locator('html')).toHaveAttribute('data-auction-audio','ready');
});

test('winner preview, confetti, four-round notes matrix and full-width colored results remain accessible',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));
 await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 await expect(page.locator('.auction-title-row')).toContainText('Mute Sound');await expect(page.getByText('Virtual Trading · Saved in This Browser')).toHaveCount(0);
 await expect(page.locator('.auction-history-table tbody tr')).toHaveCount(4);await expect(page.locator('.auction-history-table .is-pending')).toHaveCount(16);
 await page.locator('.auction-offers button').first().click();const clue=(await saved(page)).auction.clues[0];
 await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object)=>({...npc,bid:100,locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},key);
 await page.getByLabel('Bid (virtual USD)').fill('100');await page.getByLabel('Bid (virtual USD)').press('Enter');await expect(page.locator('.auction-npcs li.is-locked')).toHaveCount(4);
 await page.clock.runFor(250);await expect(page.getByRole('heading',{name:'Winner Announced'})).toBeVisible();await expect(page.locator('.auction-confetti i')).toHaveCount(40);await expect(page.getByRole('heading',{name:'Auction Settled'})).toHaveCount(0);await expect(page.locator('.auction-collection')).toHaveCount(0);
 const settled=await saved(page);await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.clock.runFor(1800);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await expectSettledPosition(page);await finishReveal(page);
 const resultWidth=await page.locator('.auction-results').evaluate(element=>element.getBoundingClientRect().width),collectionWidth=await page.locator('.auction-collection').evaluate(element=>element.getBoundingClientRect().width);expect(Math.abs(resultWidth-collectionWidth)).toBeLessThan(2);
 await expect(page.locator('.auction-result-metrics .is-gain')).not.toHaveCount(0);await expect(page.locator('.auction-result-metrics .is-cost')).toHaveCount(2);
 await expect(page.locator('.auction-history-table .is-pending')).toHaveCount(12);await expect(page.locator('.auction-history-table .is-winning')).toHaveCount(1);
 const playerBid=page.locator('.auction-history-table tbody tr').first().locator('button').first();await playerBid.hover();await expect(page.getByRole('tooltip')).toContainText(clue.text);await expect(playerBid).toHaveClass(/is-inspected/);await page.keyboard.press('Escape');await expect(page.locator('.auction-bid-popup')).toHaveCount(0);
 const npcBid=page.locator('.auction-history-table tbody tr').nth(1).locator('button').first();await npcBid.focus();await expect(page.getByRole('tooltip')).toContainText(INVESTIGATIONS.find(option=>option.id===settled.auction.npcs[0].investigations.at(-1))!.label);await expect(page.getByRole('tooltip')).not.toContainText(/Auction Card|\$/);await page.keyboard.press('Escape');
 expect(await page.locator('.auction-collection').evaluate(element=>!!(element.compareDocumentPosition(document.querySelector('.auction-bid-history')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await expect(page.locator('.auction-finish')).toHaveCSS('animation-name','auction-next-step');expect((await saved(page)).wallet).toEqual(settled.wallet);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`auction-results-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-finish')).toHaveCSS('animation-name','none');await page.setViewportSize({width:390,height:1000});await playerBid.tap();await expect(page.locator('.auction-bid-popup')).toBeVisible();await page.getByRole('heading',{name:'Bid History'}).tap();await expect(page.locator('.auction-bid-popup')).toHaveCount(0);
});

test('investigation results replace offers, controls align, neutral metrics and centered reset work',async({page},testInfo)=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});const boxes=await page.locator('.auction-bid-form input,.auction-bid-form button').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom}}));expect(Math.max(...boxes.map(box=>box.top))-Math.min(...boxes.map(box=>box.top))).toBeLessThan(1);expect(Math.max(...boxes.map(box=>box.bottom))-Math.min(...boxes.map(box=>box.bottom))).toBeLessThan(1);
  if(width===1440){const heights=await page.locator('.auction-investigate,.auction-bidding').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));expect(Math.abs(heights[0]-heights[1])).toBeLessThan(1)}
 }
 await expect(page.locator('.auction-npcs .auction-bid-status').first()).toHaveCSS('animation-name','auction-awaiting-bid');await expect(page.locator('.auction-collection-grid > .auction-card').nth(0)).not.toHaveClass(/is-hidden/);await expect(page.locator('.auction-collection-grid > .auction-card').nth(1)).not.toHaveClass(/is-hidden/);
 await page.locator('.auction-offers button').first().click();await expect(page.getByRole('heading',{name:/Investigation Results/})).toBeVisible();await expect(page.locator('.auction-offers')).toHaveCount(0);await expect(page.locator('.auction-collection .auction-clues')).toHaveCount(0);
 for(const width of [1440,390])for(const theme of ['dark','light']){await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:testInfo.outputPath(`auction-investigate-${width}-${theme}.png`),fullPage:true,animations:'disabled'})}
 await page.getByLabel('Bid (virtual USD)').fill('2000');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(3500);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);await expect(page.getByText(/Modeled Selling Fee/)).toHaveCount(0);await page.getByRole('button',{name:'Finish & manage inventory'}).click();await page.locator('.auction-inventory summary').click();await expect(page.locator('.auction-owned-card').first()).toHaveAttribute('data-rarity',/common|rare/);
 await page.getByRole('button',{name:'Reset cash & inventory'}).click();const rect=await page.getByRole('dialog').boundingBox();expect(Math.abs(rect!.x+rect!.width/2-390/2)).toBeLessThan(1);expect(Math.abs(rect!.y+rect!.height/2-1000/2)).toBeLessThan(1);await page.getByRole('button',{name:'Confirm reset'}).click();
 await page.getByRole('button',{name:'Enter free auction'}).click();await page.getByLabel('Bid (virtual USD)').fill('2000');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(3500);await page.clock.runFor(2000);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);const spend=page.locator('.auction-result-metrics > div').filter({hasText:'Your Investigation Spend'});await expect(spend).toContainText('$0.00');await expect(spend).not.toHaveClass(/is-cost|is-loss/);await spend.hover();
 const blue=await spend.evaluate(element=>{const probe=document.createElement('span');probe.style.color='var(--blue)';element.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color});await expect(spend).toHaveCSS('border-top-color',blue);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.auction-finish')).toHaveCSS('animation-name','none');
});

test('no early buyout has full-width round review and an NPC win has no player confetti',async({page})=>{
 await fixtures(page);await page.route('**/data/*.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(rows)}));await page.goto('/games/riftbound-auction');await page.getByRole('button',{name:'Enter free auction'}).click();await expect(page.getByRole('heading',{name:/Place Your Bid/})).toBeVisible();
 const force=async(bids:number[])=>page.evaluate(({key,bids})=>{const state=JSON.parse(localStorage.getItem(key)!);state.auction.npcs=state.auction.npcs.map((npc:object,index:number)=>({...npc,bid:bids[index],locked:true}));state.revision++;const raw=JSON.stringify(state);localStorage.setItem(key,raw);dispatchEvent(new StorageEvent('storage',{key,newValue:raw}))},{key,bids});
 await force([100,100,100]);await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(250);await expect(page.getByRole('heading',{name:'Round Bids',exact:true})).toBeVisible();await expect(page.getByText('No Early Buyout',{exact:true})).toBeVisible();await expect(page.getByText(/Previous bids expire/)).toHaveCount(0);await expect(page.locator('.auction-round-bids button')).toHaveCount(4);
 expect(await page.locator('.auction-results').evaluate(element=>element.getBoundingClientRect().width)).toBe(await page.locator('.auction-collection').evaluate(element=>element.getBoundingClientRect().width));
 await page.getByRole('button',{name:'Next auction round'}).click();await force([10000,4000,3000]);await page.getByLabel('Bid (virtual USD)').fill('1');await page.getByRole('button',{name:'Lock Bid',exact:true}).click();await page.clock.runFor(250);await expect(page.getByRole('heading',{name:'Winner Announced'})).toBeVisible();await expect(page.locator('.auction-confetti')).toHaveCount(0);await page.clock.runFor(1800);await expect(page.getByRole('heading',{name:'Auction Settled'})).toBeVisible();await finishReveal(page);await expect(page.getByText(/Your losing bid was not charged/)).toHaveCount(0);expect((await saved(page)).wallet.cash).toBe(250000);await expect(page.locator('.auction-history-table button')).toHaveCount(8);
});
