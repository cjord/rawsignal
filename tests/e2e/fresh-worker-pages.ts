import type {Page} from "@playwright/test";

// Local Worker HTML caches survive source/HMR changes without a deploy-version
// change. Give HTML and RSC a test-run cache key, including back/forward fetches,
// while leaving browser URLs, query-state assertions and API caches unchanged.
export async function freshWorkerPages(page:Page){
 const run=String(Date.now());
 await page.route(/\/(?:cards|sealed|sets|metrics)(?:\/|\?|$)/,route=>{
  const url=new URL(route.request().url());url.searchParams.set("e2eCache",run);
  return route.continue({url:url.toString()});
 });
}
