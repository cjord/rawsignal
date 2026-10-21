import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';

export async function checkAuctionNavigation(origin){
 const url=new URL(origin),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname),remote=['raw-signal-staging.raw-signal-watch.workers.dev','rawsignal.cards'].includes(url.hostname);
 if((!local&&!remote)||!['http:','https:'].includes(url.protocol)||remote&&url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Use a local preview or canonical Raw Signal origin.');
 const browser=await chromium.launch(),context=await browser.newContext({reducedMotion:'reduce'}),errors=[];
 try{
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url.origin+'/games/riftbound-auction',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Enter Bilgewater Auction House"]')?.disabled===false,{},{timeout:60_000});
  const timeOrigin=await page.evaluate(()=>{window.__auctionSmokeBackdrop=document.querySelector('.auction-page-art');return performance.timeOrigin});
  for(const [name,heading] of [['Inventory','Auction Inventory'],['My Showcase','Auction Showcase'],['Play','Riftbound Auction House']]){
   await page.getByRole('navigation',{name:'Auction Hub',exact:true}).getByRole('link',{name,exact:true}).click();
   await page.getByRole('heading',{name:heading,exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin,'Navigation replaced the document');
   assert.ok(await page.evaluate(()=>document.querySelector('.auction-page-art')===window.__auctionSmokeBackdrop),'Navigation replaced the backdrop');
  }
  assert.deepEqual(errors,[],'Browser navigation errors');return {origin:url.origin,links:3,documentPreserved:true,backdropPreserved:true,pageErrors:errors};
 }finally{await context.close();await browser.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)checkAuctionNavigation(process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1});
