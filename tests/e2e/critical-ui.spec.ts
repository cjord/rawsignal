import {expect,test} from "@playwright/test";

const singlesUrl="/?market=pokemon&view=medium&sort=market&direction=desc&page=1&perPage=20&mode=singles&signal=leaderboard&strictness=balanced&rarity=illustration-rares%7Cspecial-illustration-rares";
const waitForApp=async(page:import("@playwright/test").Page)=>expect(page.locator("html")).toHaveAttribute("data-app-ready","true");

test("preserves mode and view changes in browser history",async({page})=>{
 await page.goto(singlesUrl);
 await waitForApp(page);
 await expect(page.getByRole("button",{name:"Singles",exact:true})).toHaveAttribute("aria-pressed","true");
 await expect(page.getByRole("button",{name:"Medium",exact:true})).toHaveAttribute("aria-pressed","true");

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
 await expect(page).toHaveURL(/market=scalping/);
 await expect(page.getByLabel("Sealed market")).toHaveValue("scalping");
 await expect(page.locator(".sale-scenario")).toBeVisible();
 await expect(page.getByText("Products available").locator("..").locator("strong")).not.toHaveText("0");

 await page.getByLabel("Sealed market").selectOption("pokemon");
 await expect(page.locator(".sale-scenario")).toBeVisible();
 await expect(page.getByLabel("Sealed market").locator('option[value="scalping"]')).toHaveCount(1);

 await page.getByRole("button",{name:"Display settings"}).click();
 await page.getByRole("button",{name:"Regular",exact:true}).click();
 await expect(page.getByLabel("Sealed market").locator('option[value="scalping"]')).toHaveCount(0);
 await expect(page).toHaveURL(/market=pokemon/);
});
