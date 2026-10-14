import {expect,test} from "@playwright/test";

const rows=Array.from({length:18},(_,index)=>({game:"riftbound",productId:980000+index,name:`Game Card ${index+1}`,image:`https://images.example/${index}.svg`,marketPrice:index+1,printing:"Normal",section:"rares",set:"Origins",year:2025,number:String(index),rarity:"Rare",url:"",lowPrice:null,midPrice:null,highPrice:null,priceChange:null}));

test("game conceals prices, locks answers, tracks streak and advances without data calls",async({page})=>{
 const requests:string[]=[];
 await page.route("**/data/*.json",route=>{requests.push(route.request().url());return route.fulfill({contentType:"application/json",body:JSON.stringify(rows)})});
 await page.route("https://images.example/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'}));
 await page.goto("/games");await page.getByRole("link",{name:/Riftbound Price Showdown/}).click();
 await expect(page.getByRole("heading",{name:"Riftbound Price Showdown",exact:true})).toBeVisible();
 await expect(page).toHaveTitle("Riftbound Price Showdown | Raw Signal");
 const choices=page.locator(".price-game-choice");await expect(choices).toHaveCount(2);
 await expect(page.locator(".price-game-reveal")).toHaveText(["",""]);
 await page.getByLabel("Auto next round (1s)").uncheck();
 const priceOf=(name:string)=>Number(name.match(/Game Card (\d+)/)![1]);
 const names=await choices.locator(".price-game-name").allTextContents();
 const highest=names.indexOf([...names].sort((a,b)=>priceOf(b)-priceOf(a))[0]);
 await choices.nth(highest).focus();await page.keyboard.press("Enter");
 await expect(page.locator(".price-game-score dd")).toHaveText(["1","1","1"]);
 await expect(page.locator(".price-game-choice.is-correct")).toHaveCount(1);
 await expect(choices.nth(1-highest)).toHaveAttribute("aria-disabled","true");
 await choices.nth(1-highest).click({force:true});await expect(page.locator(".price-game-score dd")).toHaveText(["1","1","1"]);
 await page.getByRole("button",{name:"Next round"}).click();await expect(choices.first()).toBeFocused();
 const secondNames=await choices.locator(".price-game-name").allTextContents();
 const lowest=secondNames.indexOf([...secondNames].sort((a,b)=>priceOf(a)-priceOf(b))[0]);
 await choices.nth(lowest).click();await expect(page.locator(".price-game-score dd")).toHaveText(["1","0","2"]);
 await expect(page.locator(".price-game-choice.is-wrong")).toHaveCount(1);
 await page.getByLabel("Auto next round (1s)").check();await expect(page.locator(".price-game-score dd")).toHaveText(["1","0","3"]);
 expect(requests).toHaveLength(11);
 await page.getByRole("tab",{name:"Hard · 3 cards"}).click();await expect(choices).toHaveCount(3);await expect(page.locator(".price-game-score dd")).toHaveText(["0","0","1"]);
 expect(requests).toHaveLength(11);
});

test("game layout and tilt work on desktop/mobile in both themes with reduced motion",async({page},testInfo)=>{
 await page.route("**/data/*.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(rows)}));
 await page.route("https://images.example/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" rx="10" fill="#7557ff"/><text x="25" y="140" fill="white">Riftbound</text></svg>'}));
 for(const width of [1440,561,390])for(const theme of ["dark","light"]){
  await page.setViewportSize({width,height:1100});await page.goto("/games/riftbound-price");await expect(page.locator(".price-game-choice")).toHaveCount(2);await page.getByRole("tab",{name:"Hard · 3 cards"}).click();
  await expect(page.locator(".price-game-choice")).toHaveCount(3);
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  await expect(page.locator("body")).toHaveCSS("background-color",theme==="dark"?"rgb(13, 16, 22)":"rgb(255, 255, 255)");
  const boxes=await page.locator(".price-game-choice").evaluateAll(elements=>elements.map(element=>({x:element.getBoundingClientRect().x,y:element.getBoundingClientRect().y})));
  if(width<=600){expect(boxes[1].y).toBeGreaterThan(boxes[0].y);expect(boxes[1].x).toBe(boxes[0].x)}else{expect(boxes[1].x).toBeGreaterThan(boxes[0].x);expect(boxes[1].y).toBe(boxes[0].y)}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole("link",{name:"Games",exact:true}).filter({visible:true})).toBeVisible();
  await expect(page.locator(".price-game-art img").first()).toBeVisible();
  await expect(page.locator(".price-game-choice").first()).toHaveAttribute("aria-disabled","false");
  await page.screenshot({path:testInfo.outputPath(`game-${width}-${theme}.png`),fullPage:true,animations:"disabled"});
 }
 await page.emulateMedia({reducedMotion:"reduce"});await page.locator(".price-game-art").first().hover();
 expect(await page.locator(".price-game-art .price-game-image").first().evaluate(element=>getComputedStyle(element).transform)).toBe("none");
});

test("game skips missing, broken and placeholder artwork without counting an answer",async({page})=>{
 const cards=rows.map((card,index)=>({...card,image:index?`https://tcgplayer-cdn.tcgplayer.com/product/${index}.jpg`:""}));
 const unavailable=new Set<string>(),seen=new Set<string>();
 await page.route("**/data/*.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(cards)}));
 await page.route("https://tcgplayer-cdn.tcgplayer.com/**",route=>{
  const url=route.request().url();seen.add(url);
  if(seen.size<=2){
   unavailable.add(url);
   return seen.size===1?route.fulfill({status:404,body:"Missing"}):route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="285"/>'});
  }
  return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#7557ff"/></svg>'});
 });
 await page.goto("/games/riftbound-price");
 const choices=page.locator(".price-game-choice");await expect(choices).toHaveCount(2);
 await expect(choices.first()).toHaveAttribute("aria-disabled","false");
 expect(unavailable.size).toBe(2);
 const images=await choices.locator("img").evaluateAll(elements=>elements.map(image=>(image as HTMLImageElement).src));
 expect(images.every(src=>!unavailable.has(src))).toBe(true);
 expect(await choices.locator(".price-game-name").allTextContents()).not.toContain("Game Card 1");
 await expect(page.locator(".price-game-score dd")).toHaveText(["0","0","1"]);
 await expect(page.locator(".price-game-result")).toHaveText("");
 await expect(page.getByText("How well do you know the market? Pick the most valuable card to build your streak.")).toBeVisible();
 await expect(page.getByLabel("Auto next round (1s)")).toHaveCSS("appearance","none");
 await expect(page.getByRole("tablist",{name:"Difficulty"}).locator(".signal-slider")).toHaveCount(1);
 await page.getByRole("tab",{name:"Hard · 3 cards"}).click();await expect(choices).toHaveCount(3);
 const hardImages=await choices.locator("img").evaluateAll(elements=>elements.map(image=>(image as HTMLImageElement).src));
 expect(hardImages.every(src=>!unavailable.has(src))).toBe(true);
});

test("Games tile has the generated artwork in desktop/mobile and both themes",async({page},testInfo)=>{
 for(const width of [1440,390])for(const theme of ["dark","light"]){
  await page.setViewportSize({width,height:1000});await page.goto("/games");
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  const artwork=page.locator(".game-tile-art img");await expect(artwork).toBeVisible();
  await expect(artwork).toHaveAttribute("src","/images/games/riftbound-price-showdown.webp");
  await expect(page.locator(".game-tile-art")).toHaveClass(/is-loaded/);
  expect(await artwork.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`games-tile-${width}-${theme}.png`),fullPage:true,animations:"disabled"});
 }
});
