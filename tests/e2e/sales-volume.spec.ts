import { expect, test } from "@playwright/test";

for (const path of ["/cards/497606", "/sealed/476451?market=pokemon"]) {
  test(`paused sales summaries add no history request or UI on ${path}`, async ({ page }) => {
    const requests: URL[] = [];
    await page.route("**/api/history?**", route => {
      requests.push(new URL(route.request().url()));
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        points: [{ date: "2026-09-01", price: 10 }, { date: "2026-10-01", price: 12 }], coverage: "exact",
        variant: path.includes("sealed") ? "Sealed" : "Holofoil",
        condition: path.includes("sealed") ? "Unopened" : "Near Mint",
        change7: 0, change30: 20, change90: null, low30: 10, high30: 12, historyLow: 10, historyHigh: 12,
        // Even a cached response containing a summary must not expose the parked feature.
        salesSummary: { sales7: 12, sales30: 40, sales30Prior: 20, throughDate: null, fetchedAt: null, bucketDays: 3 },
      }) });
    });
    await page.route("**/api/ebay/listings**", route => route.fulfill({ status: 503, body: "{}" }));
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Price History" })).toBeVisible();
    await expect(page.getByText("Sales activity is unavailable for this history source.")).toBeVisible();
    await expect(page.getByLabel("TCGplayer sales volume", { exact: true })).toHaveCount(0);
    expect(requests.filter(url => url.searchParams.get("productId") === (path.includes("sealed") ? "476451" : "497606"))).toHaveLength(1);
    expect(requests.every(url => !url.searchParams.has("sales"))).toBe(true);
  });
}
