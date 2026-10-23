import {expect,test} from '@playwright/test';

for(const [name,path,ready]of [
 ['single','/cards/676093','.detail-primary-price'],
 ['sealed','/sealed/476451','.detail-primary-price'],
 ['cards','/?market=riftbound','.leader-row'],
 ['sealed-board','/?mode=sealed&market=pokemon','.sealed-row'],
] as const)for(const width of [1440,390])test(`${name}: late sans fonts retain readable controls at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 let release=()=>{};const held=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/fonts/**',async route=>{await held;await route.continue()});
 await page.route('**/api/ebay/**',route=>route.abort());
 await page.addInitScript(()=>{
  const state:{at:number;value:number}[]=[];Object.assign(window,{fontShifts:state});
  new PerformanceObserver(list=>{for(const entry of list.getEntries()){
   const shift=entry as PerformanceEntry&{hadRecentInput:boolean;value:number};
   if(!shift.hadRecentInput)state.push({at:shift.startTime,value:shift.value});
  }}).observe({type:'layout-shift',buffered:true});
 });
 try{
  await page.goto(path,{waitUntil:'domcontentloaded'});await expect(page.locator(ready).first()).toBeVisible();await page.waitForTimeout(1000);
  // The fallback must offer distinct regular/bold advances, not one regular face.
  const weights=await page.evaluate(()=>{const context=document.createElement('canvas').getContext('2d')!;return [400,800].map(weight=>{context.font=`${weight} 16px "Geist Fallback"`;return context.measureText('Cards Sets Metrics Games Holdings Buy List Import').width})});
  expect(weights[1]-weights[0]).toBeGreaterThan(15);
  const before=await page.locator(ready).first().boundingBox(),at=await page.evaluate(()=>performance.now());release();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
  const after=await page.locator(ready).first().boundingBox();expect(Math.abs(after!.y-before!.y)).toBeLessThan(3);
  const shift=await page.evaluate(at=>(window as unknown as {fontShifts:{at:number;value:number}[]}).fontShifts.filter(row=>row.at>=at).reduce((sum,row)=>sum+row.value,0),at);expect(shift).toBeLessThan(.025);
  for(const theme of ['dark','light']){await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.fontSize='large'},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`${theme}.png`),animations:'disabled'})}
  await expect(page.getByRole('button',{name:'Display settings',exact:true})).toBeVisible();
 }finally{release()}
});
