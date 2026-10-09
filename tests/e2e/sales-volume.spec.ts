import { expect, test } from "@playwright/test";

for(const path of ["/cards/497606","/sealed/476451?market=pokemon"]){
 test(`sales volume summaries remain scoped and readable on ${path}`,async({page},testInfo)=>{
  let calls=0;
  await page.route("**/api/history?**",route=>{
   const params=new URL(route.request().url()).searchParams;
   if(params.get("sales")==="1")calls++;
   return route.fulfill({contentType:"application/json",body:JSON.stringify({
    points:[{date:"2026-09-01",price:10},{date:"2026-10-01",price:12}],coverage:"exact",
    variant:path.includes("sealed")?"Sealed":"Holofoil",condition:path.includes("sealed")?"Unopened":"Near Mint",
    change7:0,change30:20,change90:null,low30:10,high30:12,historyLow:10,historyHigh:12,
    salesSummary:{sales7:12,sales30:40,sales30Prior:20,throughDate:null,fetchedAt:null,bucketDays:3},
   })});
  });
  await page.route("**/api/ebay/listings**",route=>route.fulfill({status:503,body:"{}"}));
  await page.goto(path);
  const panel=page.getByLabel("TCGplayer sales volume",{exact:true});
  for(const width of [390,1440])for(const theme of ["dark","light"]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   await expect(panel).toBeVisible();
   await expect(panel).toContainText("Sales freshness unknown");
   await expect(panel).toContainText("Copies sold (7D)");
   await expect(panel).toContainText("Copies sold (prior 30D)");
   await expect(panel).toContainText("+100.0%");
   expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   await panel.screenshot({path:testInfo.outputPath(`sales-${width}-${theme}.png`)});
  }
  expect(calls).toBe(1);
 });
}
