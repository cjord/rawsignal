import {expect,test} from "@playwright/test";

const singlesUrl="/?market=pokemon&view=medium&sort=market&direction=desc&page=1&perPage=20&mode=singles&signal=leaderboard&strictness=balanced&rarity=illustration-rares%7Cspecial-illustration-rares";
const waitForApp=async(page:import("@playwright/test").Page)=>expect(page.locator("html")).toHaveAttribute("data-app-ready","true");

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
 await expect(ebay).toHaveAttribute("rel",/sponsored/);
});

test("swaps a Pokémon card image to its TCGdex scan when the TCGplayer image fails",async({page})=>{
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
 await page.goto(singlesUrl);
 await waitForApp(page);
 // The loaded EPN script adds its own fields (toolId) to the config object, which proves it ran.
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {_epn?:{campaign?:number;smartPopover?:boolean}})._epn)).toMatchObject({campaign:5339205908,smartPopover:false});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {_epn?:{toolId?:number}})._epn?.toolId)).toBeTruthy();
 await expect(page.locator('script[src="https://epnt.ebay.com/static/epn-smart-tools.js"]')).toHaveCount(1);
});
