import { expect, test } from "@playwright/test";
import { createHistorySnapshot } from "../../core/domain/history-snapshot.ts";

for (const mode of ["singles", "sealed"] as const) for (const mismatch of [false, true]) {
  test(`${mode} rows stay stable when a ${mismatch ? "mismatched" : "matching"} hover snapshot arrives`, async ({ page }, testInfo) => {
    const printing = mode === "singles" ? "Holofoil" : "Sealed";
    const snapshots = [30, 50].map(price => createHistorySnapshot([
      { date: "2026-09-01", price: 20 }, { date: "2026-09-24", price: 10 }, { date: "2026-10-01", price },
    ], printing, mode === "singles" ? "Near Mint" : "Unopened", "exact"));
    const rows = snapshots.map((snapshot, index) => ({
      game: "pokemon", productId: 990001 + index, name: `Snapshot Fixture ${index + 1}`, set: "Fixture Set",
      image: "", url: "", marketPrice: index ? 50 : 30, midPrice: 25,
      ...(mode === "singles"
        ? { section: "illustration-rares", rarity: "Illustration Rare", year: 2026, number: `${index + 1}/100`, printing, priceChange: null, lowPrice: 1, highPrice: 100 }
        : { category: "Booster Boxes", msrp: null, msrpSource: null, profit: null, profitPct: null }),
      metrics: { snapshotId: snapshot.snapshotId, asOfDate: snapshot.asOfDate, change7: snapshot.change7, change30: snapshot.change30, low30: snapshot.low30, high30: snapshot.high30, regime: "steady" },
    }));
    await page.route("**/data/*.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(rows) }));
    const requests: string[] = [];
    await page.route("**/api/history?**", async route => {
      const url = new URL(route.request().url()), index = Number(url.searchParams.get("productId")) - 990001;
      requests.push(url.searchParams.get("snapshot") ?? "");
      await new Promise(resolve => setTimeout(resolve, 120));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(mismatch ? { ...snapshots[index], snapshotId: "newer", low30: 999, high30: 999, change7: -99, change30: -99 } : snapshots[index]) });
    });
    await page.route("**/api/catalog/detail**", route => route.fulfill({ status: 404, body: "{}" }));
    await page.addInitScript(() => localStorage.setItem("raw-signal-hover-previews", "true"));
    for (const width of [1440, 390]) for (const theme of ["dark", "light"]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(`/?mode=${mode}&market=pokemon&view=medium&sort=high&direction=asc&rarity=illustration-rares&perPage=20&snapshotFixture=${width}-${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
      await page.evaluate(theme => document.documentElement.setAttribute("data-theme", theme), theme);
      const shells = page.locator(".market-row-shell");
      await expect(shells).toHaveCount(2);
      const values = () => shells.locator("summary").allTextContents();
      const before = await values(), row = shells.first();
      const response = page.waitForResponse(response => response.url().includes("/api/history?") && response.status() === 200);
      await row.locator("summary").hover();
      await response;
      const popover = row.locator(".market-row-popover");
      if (mismatch) await expect(popover.locator(".no-chart")).toHaveText("History unavailable");
      else {
        await expect(popover.locator("svg.sparkline")).toBeVisible();
        await expect(popover.locator(".axis-high")).toContainText("30");
        await expect(popover.locator(".axis-low")).toContainText("10");
        await expect(popover.locator(".chart-delta")).toContainText("50");
      }
      expect(await values()).toEqual(before);
      expect(requests.at(-1)).toBe(snapshots[0].snapshotId);
      await row.screenshot({ path: testInfo.outputPath(`${mode}-${width}-${theme}.png`) });
      await page.mouse.move(0, 0);
    }
  });
}
