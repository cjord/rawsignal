import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';

export function summarize(values){
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),at=fraction=>sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*fraction)-1)]:null;
 const middle=Math.floor(sorted.length/2),median=sorted.length?(sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2):null;
 return {samples:sorted.length,median,p95:sorted.length>=20?at(.95):null,min:sorted[0]??null,max:sorted.at(-1)??null};
}
export function benchmarkOptions(args){
 const option=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1]},base=new URL(option('--base-url','http://localhost:4173')),samples=Number(option('--samples','3'));
 const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname),staging=base.hostname==='raw-signal-staging.raw-signal-watch.workers.dev';
 if(!['http:','https:'].includes(base.protocol)||!local&&!staging||base.username||base.password||base.pathname!=='/'||base.search||base.hash||staging&&base.protocol!=='https:')throw new Error('Use a local origin or the HTTPS staging origin. Production is intentionally excluded.');
 if(!Number.isInteger(samples)||samples<1||samples>5)throw new Error('Choose 1–5 samples per route and phase.');
 return {baseUrl:base.origin,samples};
}
export async function installBenchmarkObserver(context){
 await context.addInitScript(()=>{
  const state={unexpectedShift:0,shifts:[],supported:PerformanceObserver.supportedEntryTypes.includes('layout-shift')};
  window.__auctionBenchmark=state;
  if(state.supported)new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput){state.unexpectedShift+=entry.value;state.shifts.push({value:entry.value,at:entry.startTime,sources:(entry.sources??[]).slice(0,5).map(source=>{let node=source.node;const path=[];for(let depth=0;node&&depth<3;depth++,node=node.parentElement)path.push(node.tagName?.toLowerCase()+[...(node.classList??[])].filter(name=>/^[a-zA-Z_-]{1,50}$/.test(name)).slice(0,3).map(name=>'.'+name).join(''));return {path:path.join(' < '),from:{x:source.previousRect.x,y:source.previousRect.y,width:source.previousRect.width,height:source.previousRect.height},to:{x:source.currentRect.x,y:source.currentRect.y,width:source.currentRect.width,height:source.currentRect.height}}})});if(state.shifts.length>100)state.shifts.shift()}}).observe({type:'layout-shift',buffered:true});
 });
}
async function waitForReady(page,route){
 if(route.endsWith('/inventory')){await page.locator('.auction-inventory-manager').waitFor();await page.waitForFunction(()=>document.querySelector('.auction-market-status')?.getAttribute('data-state')==='ready',{},{timeout:20_000})}
 else if(route.endsWith('/showcase'))await page.getByRole('button',{name:'Edit Showcase',exact:true}).waitFor();
 else{await page.getByRole('button',{name:'Enter Bilgewater Auction House',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('button[aria-label="Enter Bilgewater Auction House"]')?.disabled===false,{},{timeout:20_000})}
}
export async function collectBenchmarkSample(page,route,phase,navigate,expectedOrigin=new URL(page.url()).origin){
 const requests=[],failures=[];
 const record=request=>{const url=new URL(request.url());if(url.origin===expectedOrigin)requests.push(url.pathname)};
 const failed=request=>{const url=new URL(request.url());if(url.origin===expectedOrigin)failures.push(url.pathname)};
 page.on('request',record);page.on('requestfailed',failed);
 const before=await page.evaluate(()=>({timeOrigin:performance.timeOrigin,entries:performance.getEntriesByType('resource').length,shift:window.__auctionBenchmark?.unexpectedShift??0,at:performance.now()}));
 const start=performance.now();
 try{
  await navigate();
  await waitForReady(page,route);
  const readyMs=performance.now()-start;
  // Fixed observation window, not networkidle or a wait for third-party artwork.
  await page.waitForTimeout(500);
  const measured=await page.evaluate(before=>{
   const sameDocument=performance.timeOrigin===before.timeOrigin,resources=performance.getEntriesByType('resource').slice(sameDocument?before.entries:0),origin=location.origin,firstParty=resources.filter(entry=>new URL(entry.name).origin===origin),nav=performance.getEntriesByType('navigation')[0];
   return {sameDocument,reportedTransferBytes:firstParty.reduce((sum,entry)=>sum+entry.transferSize,0),zeroTransferEntries:firstParty.filter(entry=>entry.transferSize===0).length,unexpectedLayoutShift:window.__auctionBenchmark?.supported?Math.max(0,window.__auctionBenchmark.unexpectedShift-(sameDocument?before.shift:0)):null,shiftSources:(window.__auctionBenchmark?.shifts??[]).filter(entry=>!sameDocument||entry.at>=before.at).sort((a,b)=>b.value-a.value).slice(0,10),ttfbMs:sameDocument?null:nav?.responseStart??null};
  },before);
  return {route,phase,readyMs,...measured,requests:requests.length,catalogRequests:requests.filter(path=>path.startsWith('/data/')||path==='/api/auction/catalog').length,failedRequests:failures.length,d1RowsRead:null};
 }finally{page.off('request',record);page.off('requestfailed',failed)}
}
export function benchmarkReport(samples,options){
 const groups=[...new Set(samples.map(row=>row.route+'|'+row.phase))].map(key=>{const rows=samples.filter(row=>row.route+'|'+row.phase===key);return {route:rows[0].route,phase:rows[0].phase,readyMs:summarize(rows.map(row=>row.readyMs)),catalogRequests:summarize(rows.map(row=>row.catalogRequests)),unexpectedLayoutShift:summarize(rows.map(row=>row.unexpectedLayoutShift).filter(value=>value!==null))}});
 return {version:1,at:new Date().toISOString(),...options,conditions:{identity:'isolated guest',viewport:'1440x1000',reducedMotion:true,settleMs:500,networkThrottling:false,dbCache:'uncontrolled',d1RowsRead:'not observable in browser; pair staging auction_catalog_read_cost logs',layoutShift:'unexpected shift sum during this bounded sample, not full-session Core Web Vitals CLS',transfer:'browser-reported same-origin resource bytes; excludes document/third-party bytes and is not billing traffic',percentiles:'p95 is omitted below 20 samples; small runs are smoke benchmarks, not performance proof'},groups,samples};
}
async function main(){
 const options=benchmarkOptions(process.argv.slice(2)),browser=await chromium.launch(),samples=[],base='/games/riftbound-auction',routes=[base,base+'/inventory',base+'/showcase'];
 try{for(let iteration=0;iteration<options.samples;iteration++){
  for(const route of routes){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});try{await installBenchmarkObserver(context);const page=await context.newPage();samples.push(await collectBenchmarkSample(page,route,'cold-document',()=>page.goto(options.baseUrl+route,{waitUntil:'domcontentloaded'}),options.baseUrl));samples.push(await collectBenchmarkSample(page,route,'repeat-document',()=>page.reload({waitUntil:'domcontentloaded'})))}finally{await context.close()}}
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});try{await installBenchmarkObserver(context);const page=await context.newPage();await page.goto(options.baseUrl+base,{waitUntil:'domcontentloaded'});await waitForReady(page,base);for(const [name,route] of [['Inventory',routes[1]],['My Showcase',routes[2]],['Play',base]])samples.push(await collectBenchmarkSample(page,route,'client-navigation',()=>page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name,exact:true}).click()))}finally{await context.close()}
 }}finally{await browser.close()}
 console.log(JSON.stringify(benchmarkReport(samples,options),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
