import {expect,test} from "@playwright/test";
import {rolldown} from "rolldown";

let fixtureScript:string;
test.beforeAll(async()=>{
 const bundle=await rolldown({input:"tests/helpers/pack-value-browser.tsx",platform:"browser",transform:{jsx:"react-jsx",define:{"process.env.NODE_ENV":JSON.stringify("production")}}});
 fixtureScript=(await bundle.generate({format:"iife"})).output.find(item=>item.type==="chunk")!.code;
 await bundle.close();
});
for(const game of ["pokemon","riftbound"]){
 test(`${game} EV controls scale totals and exclusions without extra requests`,async({page},testInfo)=>{
  await page.route("**/api/ebay/listings**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"available":false}'}));
  await page.goto("/sealed/476451?market=pokemon");
  await expect(page.locator(".pack-composition-table")).toHaveCSS("min-width","0px");
  const styles=await page.evaluate(()=>Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join("\n")).join("\n"));
  // A separate document prevents app hydration from replacing the component fixture.
  await page.route(`**/ev-fixture?fixtureGame=${game}`,route=>route.fulfill({contentType:"text/html",body:`<html data-theme="dark"><head><style>${styles}</style></head><body><main class="detail-page"><article class="detail-content"><section class="detail-section"><div id="fixture"></div></section></article></main></body></html>`}));
  await page.goto(`/ev-fixture?fixtureGame=${game}`);
  await page.addScriptTag({content:fixtureScript});
  const total=page.getByRole("status"),selector=page.getByLabel("Show value");
  await expect(total).toContainText("$9.00");
  let apiRequests=0;page.on("request",request=>{if(request.url().includes("/api/"))apiRequests++;});
  const packs=game==="pokemon"?36:24;
  for(const width of [390,1440])for(const theme of ["dark","light"]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   await selector.selectOption("box");
   await expect(total.locator("strong")).toHaveText(`$${9*packs}`);
   await expect(page.locator(".pack-value-facts").first()).toContainText(`${7*packs} cards per box`);
   const exclude=page.getByLabel(game==="pokemon"?"Exclude SIRs":"Exclude Signatures");
   await exclude.check();
   await expect(total.locator("strong")).toHaveText(`$${8*packs}`);
   await expect(page.locator(".pack-value-tier.is-excluded")).toContainText("Excluded from subtotal");
   await expect(page.locator(".pack-value-track>span").first()).toHaveAttribute("style","width: 87.5%;");
   if(game==="pokemon"){
    await page.getByLabel("Exclude Hyper Rares").check();
    await expect(total.locator("strong")).toHaveText("$252");
    await page.getByLabel("Exclude Hyper Rares").uncheck();
   }
   await page.locator(".detail-section").screenshot({path:testInfo.outputPath(`${game}-${width}-${theme}.png`)});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
   await selector.selectOption("pack");await expect(total).toContainText("$8.00");
   await exclude.uncheck();await expect(total).toContainText("$9.00");
  }
  expect(apiRequests).toBe(0);
  await expect(page.getByLabel("Box price",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(1);
 });
}
