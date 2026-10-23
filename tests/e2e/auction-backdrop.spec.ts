import {expect,test} from '@playwright/test';
import {auctionBackdropSlots} from '../../core/domain/auction-backdrop';

test('three decorative rows skip broken artwork and use identical gapless loop groups',async({page},testInfo)=>{
 const rows=Array.from({length:12},(_,index)=>({game:'riftbound',productId:990000+index,name:`Backdrop ${index}`,image:index===0?'':`https://images.example/backdrop/${index}.svg`,marketPrice:10,printing:'Normal',section:'rares',set:'Origins',year:2025,number:String(index),rarity:'Rare',url:'',lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));
 await page.route('**/data/*.json',route=>route.fulfill({json:rows}));await page.route('https://images.example/**',route=>route.request().url().endsWith('/1.svg')?route.fulfill({status:404,body:''}):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
 let broken='';await page.route('https://tcgplayer-cdn.tcgplayer.com/**',route=>{broken||=route.request().url();return route.request().url()===broken?route.fulfill({status:404,body:''}):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'})});
 await page.goto('/games/riftbound-auction');const backdrop=page.locator('.auction-lobby-backdrop');await expect(backdrop.locator('.auction-entry-art-lane')).toHaveCount(3);await expect(page.locator('.auction-page-scene')).toHaveCSS('isolation','isolate');
 await expect(backdrop.locator('img.is-decoded').first()).toBeAttached();
 // Viewport-sized fixed slots: rejected artwork is replaced, not removed.
 // Bounded background decoding never blocks foreground data or controls.
 await expect(backdrop.locator('img')).toHaveCount(auctionBackdropSlots(page.viewportSize()!.width)*6);
 // Shared resources decode before publishing to both repeated groups.
 const readySource=await backdrop.locator('img.is-decoded').first().getAttribute('src');
 await expect.poll(()=>backdrop.locator(`img[src="${readySource}"]`).evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&image.classList.contains('is-decoded')))).toBe(true);
 for(const width of [3343,390])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await expect(backdrop.locator('img')).toHaveCount(auctionBackdropSlots(width)*6);
  await expect.poll(()=>backdrop.locator('img').evaluateAll(images=>images.every(image=>Boolean(image.getAttribute('src'))))).toBe(true);
  const geometry=await backdrop.locator('.auction-entry-art-lane').evaluateAll(lanes=>lanes.map(lane=>({width:lane.getBoundingClientRect().width,groups:[...lane.children].map(group=>({width:group.getBoundingClientRect().width,images:[...group.querySelectorAll('img')].map(image=>image.src.replace(/_(?:in_1000x1000|200w)\.jpg$/,'.jpg'))}))})));
  expect(new Set(geometry.flatMap(lane=>lane.groups.flatMap(group=>group.images))).size).toBeLessThanOrEqual(18);
  for(const lane of geometry){expect(lane.groups[0].width).toBeGreaterThan(width-1);expect(lane.groups[0].images).toEqual(lane.groups[1].images);expect(Math.abs(lane.groups[0].width-lane.groups[1].width)).toBeLessThan(.02);expect(Math.abs(lane.width-lane.groups[0].width*2)).toBeLessThan(1);}
  const seam=await backdrop.locator('.auction-entry-art-lane').evaluateAll(lanes=>lanes.map(lane=>{
   const animation=lane.getAnimations()[0];animation.pause();const duration=Number(animation.effect!.getTiming().duration);
   const positions=(time:number)=>{animation.currentTime=time;return [...lane.querySelectorAll('img')].map(image=>({src:image.src,x:image.getBoundingClientRect().x,right:image.getBoundingClientRect().right})).filter(row=>row.right>0&&row.x<innerWidth).sort((a,b)=>a.x-b.x)};
   return {start:positions(.01),end:positions(duration-.01)};
  }));
  for(const row of seam){expect(row.start.map(r=>r.src)).toEqual(row.end.map(r=>r.src));for(let i=0;i<row.start.length;i++)expect(Math.abs(row.start[i].x-row.end[i].x)).toBeLessThan(1)}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`backdrop-${width}-${theme}.png`)});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await expect(backdrop.locator('.auction-entry-art-lane').first()).toHaveCSS('animation-name','none');
});

test('failed artwork changes only its twins; several forward/reverse loops retain sources and animations',async({page})=>{
 let requests=0;await page.route('https://tcgplayer-cdn.tcgplayer.com/**',route=>{requests++;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'})});
 await page.goto('/games/riftbound-auction');const images=page.locator('.auction-lobby-backdrop img');
 await expect.poll(()=>images.evaluateAll(nodes=>nodes.every(node=>node.classList.contains('is-decoded')))).toBe(true);
 const before=await images.evaluateAll(nodes=>{
  Object.assign(window,{stableBackdropImages:nodes,stableBackdropAnimations:[...document.querySelectorAll('.auction-lobby-backdrop .auction-entry-art-lane')].map(lane=>lane.getAnimations()[0])});
  return nodes.map(node=>(node as HTMLImageElement).src);
 });
 await images.first().evaluate(node=>node.dispatchEvent(new Event('error')));await expect(images.first()).not.toHaveAttribute('src',before[0]);
 await expect.poll(()=>images.evaluateAll(nodes=>nodes.every(node=>node.classList.contains('is-decoded')))).toBe(true);
 const after=await images.evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src));
 expect(after[0]).not.toBe(before[0]);after.forEach((source,index)=>{if(before[index]===before[0])expect(source).toBe(after[0]);else expect(source).toBe(before[index])});
 const work=requests;
 const retained=await page.evaluate(()=>{
  const saved=window as unknown as {stableBackdropImages:Element[];stableBackdropAnimations:Animation[]};
  return [...document.querySelectorAll('.auction-lobby-backdrop .auction-entry-art-lane')].every((lane,index)=>{
   const animation=lane.getAnimations()[0];if(animation!==saved.stableBackdropAnimations[index])return false;
   animation.pause();const duration=Number(animation.effect!.getTiming().duration);
   for(let cycle=0;cycle<4;cycle++){animation.currentTime=duration*(cycle+.25);if(lane.getAnimations()[0]!==animation)return false}
   return true;
  })&&[...document.querySelectorAll('.auction-lobby-backdrop img')].every((node,index)=>node===saved.stableBackdropImages[index]);
 });
 expect(retained).toBe(true);expect(await images.evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src))).toEqual(after);expect(requests).toBe(work);
});

test('viewport changes preserve lane pixel offsets instead of restarting the loop',async({page})=>{
 await page.route('https://tcgplayer-cdn.tcgplayer.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>'}));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/games/riftbound-auction');
 const lanes=page.locator('.auction-lobby-backdrop .auction-entry-art-lane');await expect(lanes).toHaveCount(3);
 await expect(page.locator('.auction-lobby-backdrop img')).toHaveCount(auctionBackdropSlots(1440)*6);
 // Wait for ResizeObserver's initial measurement before changing the viewport.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const before=await lanes.evaluateAll(nodes=>nodes.map(lane=>{const animation=lane.getAnimations()[0];animation.pause();animation.currentTime=20000;return {x:new DOMMatrix(getComputedStyle(lane).transform).m41,width:lane.children[0].getBoundingClientRect().width}}));
 await page.setViewportSize({width:1920,height:1000});await expect(page.locator('.auction-lobby-backdrop img')).toHaveCount(auctionBackdropSlots(1920)*6);
 await expect.poll(()=>lanes.evaluateAll(nodes=>nodes.map(lane=>new DOMMatrix(getComputedStyle(lane).transform).m41))).toEqual(before.map(row=>expect.closeTo(row.x,1)));
});
