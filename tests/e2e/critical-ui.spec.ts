import {expect,test} from "@playwright/test";

const singlesUrl="/?market=pokemon&view=medium&sort=market&direction=desc&page=1&perPage=20&mode=singles&signal=leaderboard&strictness=balanced&rarity=illustration-rares%7Cspecial-illustration-rares";
const waitForApp=async(page:import("@playwright/test").Page)=>expect(page.locator("html")).toHaveAttribute("data-app-ready","true");

test("Lunar Irelia keeps unavailable prices and Chinese affiliate access on mobile and desktop",async({page},testInfo)=>{
 await page.route("**/api/ebay/listings**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"available":false}'}));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto("/cards/900000001?coverage=20260918");
  await expect(page.locator("h1")).toContainText("Lunar Revel 2026");
  await expect(page.locator(".detail-primary-price strong")).toHaveText("N/A");
  const ebay=new URL((await page.getByRole("link",{name:"eBay ↗",exact:true}).getAttribute("href"))!);
  expect(ebay.searchParams.get("Language")).toBe("Chinese");expect(ebay.searchParams.get("campid")).toBe("5339205908");
  await expect(page.locator(".detail-actions").getByRole("link",{name:"Search on TCGplayer ↗"})).toHaveAttribute("href",/search/);
  await page.locator(".detail-hero").screenshot({path:testInfo.outputPath(`lunar-${width}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 }
});

test("unpriced Metal promos keep their eBay grid and affiliate links at phone and desktop widths",async({page},testInfo)=>{
 await page.route("**/api/history?**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({points:[],coverage:"none",change7:null,change30:null,change90:null,low30:null,high30:null,historyLow:null,historyHigh:null})}));
 const sample={itemId:"metal-fixture",title:"Riftbound Kai'Sa Daughter of the Void Metal Best Of 247/298 English",price:900,shipping:0,deliveredPrice:900,condition:"Ungraded",imageUrl:null,url:"https://www.ebay.com/itm/123?campid=5339205908",buyingOptions:["FIXED_PRICE"],matchConfidence:"high"};
 await page.route("**/api/ebay/listings?productId=669250",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({snapshot:{query:"fixture",categoryId:183454,listingCount:1,reviewedCount:1,acceptedCount:1,highConfidenceCount:1,lowestAsk:null,medianAsk:null,lowestDeliveredAsk:null,medianDeliveredAsk:null,deliveredQ1:null,deliveredQ3:null,belowMarketCount:0,nearMarketCount:0,freeShippingCount:1,bestOfferCount:0,samples:[sample],fetchedAt:"2026-09-18T12:00:00Z",expiresAt:"2026-09-18T18:00:00Z",updatedAt:"2026-09-18"},history:{points:[]}})}));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto("/cards/669250?e2e=unpriced-metal-v1");
  await expect(page.locator("h1")).toContainText("Metal");
  await expect(page.locator(".detail-primary-price strong")).toHaveText("N/A");
  await page.locator(".detail-ebay").scrollIntoViewIfNeeded();
  await expect(page.locator(".ebay-listing-card")).toHaveCount(1);
  await expect(page.locator(".ebay-listing-card")).toContainText("$900");
  const link=page.getByRole("link",{name:"Browse eBay ↗"});
  const url=new URL((await link.getAttribute("href"))!);
  expect(url.searchParams.get("_nkw")).toContain("Metal Best Of");expect(url.searchParams.get("campid")).toBe("5339205908");
  for(const theme of ["dark","light"]){
   await page.evaluate(theme=>document.documentElement.setAttribute("data-theme",theme),theme);
   await page.locator(".detail-ebay").screenshot({path:testInfo.outputPath(`metal-${width}-${theme}.png`)});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
 }
});

test("pack profiles distinguish English odds and Japanese deluxe packs at phone and desktop sizes",async({page},testInfo)=>{
 await page.route("**/api/ebay/listings**",route=>route.fulfill({status:503,contentType:"application/json",body:'{"available":false}'}));
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  // A fresh URL avoids persisted local Worker HTML from a previous source revision.
  await page.goto("/sealed/476451?market=pokemon&packProfileVersion=2");
  const panel=page.getByRole("region",{name:"Pack composition and estimated value"});
  await expect(panel).toContainText("English booster · 10 cards");
  await expect(panel).toContainText("8,000");
  // vinext attaches the component stylesheet during hydration on a cold detail load.
  await expect(panel.locator(".pack-composition-table")).toHaveCSS("min-width","0px");
  const countBox=await panel.getByRole("cell",{name:"4",exact:true}).boundingBox();
  expect(countBox).not.toBeNull();
  expect(countBox!.x+countBox!.width).toBeLessThanOrEqual(width);
  await expect(panel.getByRole("link",{name:"Source 2"})).toHaveAttribute("href",/tcgplayer/);
  for(const theme of ["dark","light"]){
   await page.evaluate(theme=>document.documentElement.setAttribute("data-theme",theme),theme);
   await panel.scrollIntoViewIfNeeded();
   await panel.screenshot({path:testInfo.outputPath(`pack-${width}-${theme}.png`)});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
  await page.goto("/sealed/636739?market=pokemon&packProfileVersion=2");
  await expect(panel).toContainText("Japanese booster · 35 cards");
  await expect(panel).toContainText("Set-specific pull rates unavailable");
  await expect(page.getByRole("heading",{name:"Pull Rates",exact:true})).toHaveCount(0);
 }
});

test("preserves mode and view changes in browser history",async({page})=>{
 await page.goto(singlesUrl);
 await waitForApp(page);
 await expect(page.getByRole("button",{name:"Singles",exact:true})).toHaveAttribute("aria-pressed","true");
 await expect(page.getByRole("button",{name:"Medium",exact:true})).toHaveAttribute("aria-pressed","true");
 // Migrated from the retired source-pin suite (D7): the numbered pagination renders and
 // the Metrics surface stays reachable from the top bar.
 await expect(page.locator(".pagination")).toBeVisible();
 await expect(page.getByRole("link",{name:"Metrics"})).toHaveAttribute("href","/metrics");

 await page.getByRole("button",{name:"Sealed",exact:true}).click();
 await expect(page).toHaveURL(/mode=sealed/);
 await expect(page.getByRole("button",{name:"Sealed",exact:true})).toHaveAttribute("aria-pressed","true");

 await page.goBack();
 await expect(page).toHaveURL(/mode=singles/);
 await expect(page.getByRole("button",{name:"Singles",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.goForward();
 await expect(page).toHaveURL(/mode=sealed/);

 await page.getByRole("button",{name:"Text",exact:true}).click();
 await expect(page).toHaveURL(/view=text/);
 await expect(page.getByRole("button",{name:"Text",exact:true})).toHaveAttribute("aria-pressed","true");
 await expect(page.locator(".sealed-rows.sealed-view-text")).toBeVisible();
});

test("keeps core leaderboard controls operable at phone width",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(singlesUrl);
 await waitForApp(page);

 const search=page.getByPlaceholder("Search card, set, or number");
 await expect(search).toBeVisible();
 await search.fill("umbreon 161");
 await expect(page).toHaveURL(/(?:\?|&)q=umbreon(?:\+|%20)161/);

 await page.getByRole("button",{name:"Text",exact:true}).click();
 await expect(page.locator(".rows.view-text")).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);

 await page.locator(".card-filters > summary").click();
 await expect(page.locator(".card-filters")).toHaveAttribute("open","");
 await page.locator("body").click({position:{x:1,y:1}});
 await expect(page.locator(".card-filters")).not.toHaveAttribute("open","");
});

test("applies Singles filters only on confirmation and discards canceled edits",async({page})=>{
 await page.goto(singlesUrl);
 await waitForApp(page);
 const filters=page.locator(".card-filters");
 const initialUrl=page.url();
 const initialCount=await page.locator(".leader-row").count();
 await filters.locator("summary").click();
 await filters.getByRole("spinbutton",{name:"Minimum market price"}).fill("100");
 expect(page.url()).toBe(initialUrl);
 await expect(page.locator(".leader-row")).toHaveCount(initialCount);
 await filters.getByRole("button",{name:"Cancel"}).click();
 await expect(filters).not.toHaveAttribute("open","");
 await filters.locator("summary").click();
 await expect(filters.getByRole("spinbutton",{name:"Minimum market price"})).toHaveValue("");
 await filters.getByRole("spinbutton",{name:"Minimum market price"}).fill("100");
 await filters.getByRole("button",{name:"Apply filters"}).click();
 await expect(page).toHaveURL(/(?:\?|&)minPrice=100(?:&|$)/);
 await expect(filters).not.toHaveAttribute("open","");
 await filters.locator("summary").click();
 await filters.getByRole("button",{name:"Clear all"}).click();
 await expect(filters.getByRole("spinbutton",{name:"Minimum market price"})).toHaveValue("");
 await expect(page).toHaveURL(/(?:\?|&)minPrice=100(?:&|$)/);
 await filters.getByRole("button",{name:"Apply filters"}).click();
 await expect(page).not.toHaveURL(/minPrice=/);
});

test("keeps mobile Sealed filter close and apply controls reachable",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/?mode=sealed&market=pokemon&view=medium&sort=market&direction=desc&page=1&perPage=20");
 await waitForApp(page);
 const filters=page.locator(".card-filters");
 const initialUrl=page.url();
 await filters.locator("summary").click();
 const close=filters.getByRole("button",{name:"Close filters"});
 const apply=filters.getByRole("button",{name:"Apply filters"});
 await expect(close).toBeInViewport();
 await expect(apply).toBeInViewport();
 await filters.getByRole("spinbutton",{name:"Minimum market value"}).fill("80");
 expect(page.url()).toBe(initialUrl);
 await close.click();
 await expect(filters).not.toHaveAttribute("open","");
 await filters.locator("summary").click();
 await expect(filters.getByRole("spinbutton",{name:"Minimum market value"})).toHaveValue("");
 await filters.getByRole("spinbutton",{name:"Minimum market value"}).fill("80");
 await apply.click();
 await expect(page).toHaveURL(/(?:\?|&)marketMin=80(?:&|$)/);
 await expect(filters).not.toHaveAttribute("open","");
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test("persists display preferences without changing market state",async({page})=>{
 await page.goto(singlesUrl);
 await waitForApp(page);
 const initialUrl=page.url();
 await page.getByRole("button",{name:/Switch to light mode/}).click();
 await expect(page.locator("html")).toHaveAttribute("data-theme","light");
 expect(page.url()).toBe(initialUrl);
 await page.reload();
 await waitForApp(page);
 await expect(page.locator("html")).toHaveAttribute("data-theme","light");
});

test("enables Scalper features without navigating away from Singles",async({page})=>{
 await page.addInitScript(()=>localStorage.removeItem("raw-signal-scalper-mode"));
 await page.goto(singlesUrl);
 await waitForApp(page);
 await page.getByRole("button",{name:"Display settings"}).click();
 await page.getByRole("button",{name:"Scalper",exact:true}).click();
 await expect(page).toHaveURL(/mode=singles/);
 await expect(page.getByRole("button",{name:"Singles",exact:true})).toHaveAttribute("aria-pressed","true");

 await page.getByRole("button",{name:"Sealed",exact:true}).click();
 // Scalper mode never changes the market by itself — it only unlocks Obey Products.
 await expect(page).toHaveURL(/market=pokemon/);
 await expect(page.getByRole("tab",{name:"Obey Products"})).toHaveCount(1);
 await expect(page.locator(".sale-scenario")).toBeVisible();
 await expect(page.locator(".sale-scenario summary")).toHaveCount(0);

 await page.getByRole("tab",{name:"Obey Products"}).click();
 await expect(page).toHaveURL(/market=scalping/);
 await expect(page.getByRole("tab",{name:"Obey Products"})).toHaveAttribute("aria-selected","true");
 await page.getByLabel("Shipping cost").fill("5");
 await page.getByLabel("Include sales tax").check();
 await page.getByLabel("Profitable products only").check();
 await expect(page.locator(".leader-filter-summary")).toContainText("Shipping: $5.00");
 await expect(page.locator(".leader-filter-summary")).toContainText("Sales Tax: 8%");
 await expect(page.locator(".leader-filter-summary")).toContainText("Profitable Only");
 await expect(page.locator(".sealed-count-line strong")).not.toHaveText("0");

 await page.getByRole("tab",{name:"Pokémon",exact:true}).click();
 await expect(page).toHaveURL(/market=pokemon/);
 await expect(page.locator(".sale-scenario")).toBeVisible();
 await expect(page.getByRole("tab",{name:"Obey Products"})).toHaveCount(1);

 await page.getByRole("button",{name:"Display settings"}).click();
 await page.getByRole("button",{name:"Regular",exact:true}).click();
 await expect(page.getByRole("tab",{name:"Obey Products"})).toHaveCount(0);
 await expect(page).toHaveURL(/market=pokemon/);
});

test("opens a row's hover chart with TCGplayer and eBay link tiles under the artwork",async({page})=>{
 await page.goto(singlesUrl);
 await waitForApp(page);
 const row=page.locator(".market-row-shell").first();
 await row.locator("summary").hover();
 // The marketplace tiles sit under the card image (2026-09-09), not in the stats grid.
 const links=row.locator(".market-row-popover .hover-card-art .hover-card-links a");
 await expect(links).toHaveCount(2);
 await expect(row.locator(".market-row-popover .history-stats a")).toHaveCount(0);
 const tile=links.filter({hasText:"TCGplayer"});
 await expect(tile).toBeVisible();
 // Affiliate link (O1): the Impact tracking URL deep-linking to the product page, marked sponsored.
 await expect(tile).toHaveAttribute("href",/^https:\/\/partner\.tcgplayer\.com\/c\/7677898\/1780961\/21018\?u=https%3A%2F%2Fwww\.tcgplayer\.com%2Fproduct%2F\d+/);
 await expect(tile).toHaveAttribute("rel",/sponsored/);
 await expect(tile).toHaveAttribute("target","_blank");
 const ebay=links.filter({hasText:"eBay"});
 await expect(ebay).toHaveAttribute("href",/^https:\/\/www\.ebay\.com\/sch\/i\.html\?_nkw=Pokemon/);
 const ebayUrl=new URL((await ebay.getAttribute("href"))!);
 expect(ebayUrl.searchParams.get("campid")).toBe("5339205908");
 expect(ebayUrl.searchParams.get("mkevt")).toBe("1");
 expect(ebayUrl.searchParams.get("toolid")).toBe("10001");
 await expect(ebay).toHaveAttribute("rel",/sponsored/);
});

test("matches card and sealed metric typography and tone tiles in mobile popups",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(singlesUrl);await waitForApp(page);
 const openPopup=async(requireDown=false)=>{
  let rows=page.locator(".market-row-shell").filter({has:page.locator(".history-stats b.up")});
  if(requireDown)rows=rows.filter({has:page.locator(".history-stats b.down")});
  const row=rows.first();
  await row.evaluate(element=>{(element as HTMLDetailsElement).open=true});await expect(row).toHaveAttribute("open","");
  const label=row.locator(".history-stats small").first(),value=row.locator(".history-stats b").first();
  const upTile=row.locator(".history-stats > span").filter({has:page.locator("b.up")}).first();
  const neutralTile=row.locator(".history-stats > span").filter({has:page.locator("b:not(.up):not(.down)")}).first();
  await expect(label).toHaveCSS("text-transform","uppercase");
  const styles=await page.evaluate(([labelElement,valueElement,upElement,neutralElement])=>{
   const labelStyle=getComputedStyle(labelElement),valueStyle=getComputedStyle(valueElement),upStyle=getComputedStyle(upElement),neutralStyle=getComputedStyle(neutralElement);
   return {labelFont:labelStyle.font,labelSpacing:labelStyle.letterSpacing,valueFont:valueStyle.font,upBackground:upStyle.backgroundColor,upBorder:upStyle.borderColor,neutralBackground:neutralStyle.backgroundColor,neutralBorder:neutralStyle.borderColor};
  },[await label.elementHandle(),await value.elementHandle(),await upTile.elementHandle(),await neutralTile.elementHandle()]);
  expect(styles.upBackground).not.toBe(styles.neutralBackground);expect(styles.upBorder).not.toBe(styles.neutralBorder);
  if(requireDown){
   const downTile=row.locator(".history-stats > span").filter({has:page.locator("b.down")}).first();
   const downStyles=await downTile.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderColor}));
   expect(downStyles.background).not.toBe(styles.neutralBackground);expect(downStyles.border).not.toBe(styles.neutralBorder);
  }
  return styles;
 };
 const cardStyles=await openPopup(true);
 await page.getByRole("button",{name:"Sealed",exact:true}).click();await expect(page).toHaveURL(/mode=sealed/);
 const sealedStyles=await openPopup();
 expect(cardStyles.labelFont).toBe(sealedStyles.labelFont);expect(cardStyles.labelSpacing).toBe(sealedStyles.labelSpacing);expect(cardStyles.valueFont).toBe(sealedStyles.valueFont);
 await page.getByRole("button",{name:/Switch to light mode/}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","light");
 await openPopup();
});

test("keeps Riftbound pair multiples on eligible detail pages and out of leaderboard popups",async({page})=>{
 await page.setViewportSize({width:1200,height:850});
 await page.goto("/?market=riftbound&view=medium&mode=singles&signal=leaderboard&rarity=signatures");
 await waitForApp(page);
 const desktopRow=page.locator(".market-row-shell").first();
 await desktopRow.evaluate(element=>{(element as HTMLDetailsElement).open=true});
 await expect(desktopRow.locator(".market-row-popover").getByText("Individual multiplier",{exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/?market=riftbound&view=medium&mode=singles&signal=leaderboard&rarity=signatures");
 await waitForApp(page);
 const mobileRow=page.locator(".market-row-shell").first();
 await mobileRow.evaluate(element=>{(element as HTMLDetailsElement).open=true});
 await expect(mobileRow.getByText("Individual multiplier",{exact:true})).toHaveCount(0);
 await page.goto("/cards/653102");
 const panel=page.locator(".detail-riftbound-pair");
 await expect(panel).toBeVisible();
 await expect(panel.getByText("Individual multiplier",{exact:true})).toBeVisible();
 await expect(panel.getByText("All-pair average",{exact:true})).toBeVisible();
 await expect(panel.getByText("Set average",{exact:true})).toBeVisible();
 await expect(panel.locator(".detail-metric>span").filter({hasText:/[+−]\d+\.\d{2}× \([+−]\d+%\) vs/}).first()).toBeVisible();
 await expect(page.locator(".market-median-context")).toContainText("Trends use Market.");
});

test("shows material Market versus Listed Median context for sealed products",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/?mode=sealed&market=riftbound&view=full&q=Arcane%20Box%20Set");
 await waitForApp(page);
 await expect(page.locator(".sealed-full-card .market-median-context")).toContainText("Listed Median");
 await page.goto("/sealed/655495?market=riftbound");
 await expect(page.locator(".detail-overview .market-median-context")).toContainText("Trends use Market.");
});

test("swaps a Pokémon card image to its TCGdex scan when the TCGplayer image fails",async({page})=>{
 const svgImage=(width:number,height:number)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
 await page.route("https://tcgplayer-cdn.tcgplayer.com/**",route=>route.fulfill({status:200,contentType:"image/svg+xml",body:svgImage(route.request().url().includes("/product/0_")?400:2,route.request().url().includes("/product/0_")?570:3)}));
 await page.route("https://assets.tcgdex.net/**",route=>route.fulfill({status:200,contentType:"image/svg+xml",body:svgImage(2,3)}));
 await page.goto(singlesUrl);
 await waitForApp(page);
 const image=page.locator(".leader-row .identity img").first();
 await expect(image).toBeVisible();
 await expect(image).toHaveAttribute("src",/tcgplayer-cdn\.tcgplayer\.com/);
 // Point the loaded image at a product the CDN has no photo for: it answers with its 400×570 placeholder JPEG,
 // which the component treats as a failure and retries once with the fallback scan.
 await image.evaluate(element=>{(element as HTMLImageElement).src="https://tcgplayer-cdn.tcgplayer.com/product/0_in_1000x1000.jpg"});
 await expect(page.locator(".leader-row .identity img").first()).toHaveAttribute("src",/^https:\/\/assets\.tcgdex\.net\/en\//);
});

test("configures eBay Smart Links with the site campaign and no popover",async({page})=>{
 await page.route("https://epnt.ebay.com/static/epn-smart-tools.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window._epn=window._epn||{};window._epn.toolId=10001;"}));
 await page.goto(singlesUrl);
 await waitForApp(page);
 // The loaded EPN script adds its own fields (toolId) to the config object, which proves it ran.
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {_epn?:{campaign?:number;smartPopover?:boolean}})._epn)).toMatchObject({campaign:5339205908,smartPopover:false});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {_epn?:{toolId?:number}})._epn?.toolId)).toBeTruthy();
 await expect(page.locator('script[src="https://epnt.ebay.com/static/epn-smart-tools.js"]')).toHaveCount(1);
});

test("paginates cached eBay results five-up on desktop and three-up on mobile",async({page})=>{
 const samples=Array.from({length:40},(_,index)=>({itemId:`v1|${index+1}|0`,title:`Listing ${index+1}`,price:20+index,shipping:index%2?4.5:0,deliveredPrice:20+index+(index%2?4.5:0),condition:"Ungraded",imageUrl:null,url:`https://www.ebay.com/itm/${index+1}`,buyingOptions:index%3?["FIXED_PRICE"]:["FIXED_PRICE","BEST_OFFER"],sellerFeedbackPercentage:99.8,sellerFeedbackScore:1200,topRated:index%2===0,watchCount:index,listedAt:`2026-08-${String(index%28+1).padStart(2,"0")}T00:00:00Z`,endsAt:null,locationCountry:"US",matchConfidence:index%2?"medium":"high"}));
 const history={points:[{observedDate:"2026-09-03",observedAt:"2026-09-03T12:00:00.000Z",referenceMarketPrice:25,listingCount:38,reviewedCount:10,acceptedCount:10,lowestAsk:19,medianAsk:24,lowestDeliveredAsk:19,medianDeliveredAsk:24,deliveredQ1:21,deliveredQ3:27,belowMarketCount:6,nearMarketCount:4,freeShippingCount:5,bestOfferCount:3,newListingCount:null,missingListingCount:null,priceReductionCount:null},{observedDate:"2026-09-10",observedAt:"2026-09-10T12:00:00.000Z",referenceMarketPrice:25,listingCount:42,reviewedCount:12,acceptedCount:12,lowestAsk:20,medianAsk:25.5,lowestDeliveredAsk:20,medianDeliveredAsk:27,deliveredQ1:23,deliveredQ3:30,belowMarketCount:5,nearMarketCount:4,freeShippingCount:6,bestOfferCount:4,newListingCount:3,missingListingCount:1,priceReductionCount:2}]};
 await page.route("**/api/ebay/listings?productId=*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({snapshot:{query:"fixture",categoryId:183454,listingCount:42,reviewedCount:12,acceptedCount:12,highConfidenceCount:6,lowestAsk:20,medianAsk:25.5,lowestDeliveredAsk:20,medianDeliveredAsk:27,deliveredQ1:23,deliveredQ3:30,belowMarketCount:5,nearMarketCount:4,freeShippingCount:6,bestOfferCount:4,samples,fetchedAt:"2026-09-10T12:00:00.000Z",expiresAt:"2026-09-10T18:00:00.000Z",updatedAt:"2026-09-10"},history})}));
 await page.goto(singlesUrl);await waitForApp(page);
 const detailHref=await page.locator('a[href^="/cards/"]').first().getAttribute("href");
 expect(detailHref).toBeTruthy();await page.goto(`${detailHref}?e2e=ebay-layout-v2`);await expect(page.locator(".detail-page")).toBeVisible();
 await page.locator(".detail-ebay").scrollIntoViewIfNeeded();
 await expect(page.locator(".ebay-listing-card")).toHaveCount(5);
 await expect(page.locator(".detail-ebay > .detail-ev-grid .detail-metric")).toHaveCount(4);
 await expect(page.locator(".detail-ebay > .detail-ev-grid .detail-metric",{hasText:"Free shipping"})).toHaveCount(0);
 await expect(page.locator(".detail-ebay > .detail-ev-grid .detail-metric",{hasText:"Best Offer"})).toHaveCount(0);
 await expect(page.locator(".detail-ebay > .detail-ev-grid .detail-metric",{hasText:"eBay result estimate"})).toHaveCount(0);
 await expect(page.locator(".detail-ebay > .detail-ev-grid .detail-metric",{hasText:"Near TCGplayer"})).toHaveCount(0);
 await expect(page.getByText("Showing 1–5 of 40 filtered listings")).toBeVisible();
 await expect(page.getByRole("navigation",{name:"eBay listing pages"}).locator(".page-numbers button")).toHaveCount(5);
 await expect(page.getByText("Delivered ask (7D)")).toBeVisible();
 await page.getByLabel("Filter listings").selectOption("free-shipping");
 await expect(page.getByText("Showing 1–5 of 20 filtered listings")).toBeVisible();
 await page.getByLabel("Filter listings").selectOption("all");
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator(".ebay-listing-card")).toHaveCount(3);
 await expect(page.getByText("Showing 1–3 of 40 filtered listings")).toBeVisible();
 const ebayPages=page.getByRole("navigation",{name:"eBay listing pages"});
 await expect(ebayPages.locator(".page-numbers button")).toHaveCount(4);
 await expect(ebayPages).toHaveCSS("grid-template-columns",/\S+ \S+ \S+/);
 await expect(page.locator(".ebay-actions")).toHaveCSS("grid-template-columns",/\S+ \S+/);
 const firstListing=page.locator(".ebay-listing-card").first();
 await expect(firstListing).toHaveCSS("grid-template-columns",/96px \S+/);
 await expect(firstListing.locator(".best-offer")).toHaveCSS("color","rgb(41, 184, 120)");
 const infoButton=page.getByRole("button",{name:"About Lowest delivered"});
 await infoButton.click();await expect(infoButton).toHaveAttribute("aria-expanded","true");
 await page.getByRole("heading",{name:"eBay Listings"}).click();await expect(infoButton).toHaveAttribute("aria-expanded","false");
 await ebayPages.getByRole("button",{name:"Next →"}).click();
 await expect(page.locator(".ebay-listing-card")).toHaveCount(3);
 await expect(page.getByText("Showing 4–6 of 40 filtered listings")).toBeVisible();
 await expect(page.locator(".ebay-listing-card").first()).toHaveAttribute("href","https://www.ebay.com/itm/2");

 await page.goto("/?mode=sealed&market=pokemon&view=medium&sort=market&direction=desc&page=1&perPage=20");await waitForApp(page);
 const sealedHref=await page.locator('a[href^="/sealed/"]').first().getAttribute("href");
 expect(sealedHref).toBeTruthy();await page.goto(`${sealedHref}?e2e=ebay-layout-sealed-v2`);await expect(page.locator(".detail-page")).toBeVisible();
 await page.locator(".detail-ebay").scrollIntoViewIfNeeded();
 await expect(page.locator(".detail-ebay > .detail-ev-grid .detail-metric")).toHaveCount(4);
 await expect(page.locator(".ebay-listing-card")).toHaveCount(3);
 await expect(page.locator(".ebay-actions")).toHaveCSS("grid-template-columns",/\S+ \S+/);
 await page.setViewportSize({width:1280,height:900});
 await expect(page.locator(".ebay-listing-card")).toHaveCount(5);
});

test("paginates More Sealed six-up with the shared mobile control row",async({page})=>{
 await page.goto(singlesUrl);await waitForApp(page);
 const detailHref=await page.locator('a[href^="/cards/"]').first().getAttribute("href");
 expect(detailHref).toBeTruthy();await page.goto(`${detailHref}?e2e=related-sealed-mobile`);await expect(page.locator(".detail-page")).toBeVisible();
 const related=page.locator("section.detail-market-table").filter({has:page.getByRole("heading",{name:/More Sealed from/})});
 await related.scrollIntoViewIfNeeded();await expect(related.locator(".leader-row")).toHaveCount(6);
 await expect(related.getByText("Showing 1–6 of 12 sealed products")).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 const pagination=related.getByRole("navigation",{name:/sealed pages/});
 await expect(pagination.locator(".page-numbers button")).toHaveCount(2);
 await expect(pagination).toHaveCSS("grid-template-columns",/\S+ \S+ \S+/);
 await pagination.getByRole("button",{name:"Next →"}).click();
 await expect(related.locator(".leader-row")).toHaveCount(6);
 await expect(related.locator(".position").first()).toHaveText("07");
 await expect(related.getByText("Showing 7–12 of 12 sealed products")).toBeVisible();
});
