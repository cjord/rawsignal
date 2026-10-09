import { expect, test } from "@playwright/test";

const cell = (change: number, total: number) => ({ change, total, eligible: total, coverage: 1, smallSample: total < 3, reason: null });
const windows = (change: number, total: number) => ({ 7: cell(change, total), 30: cell(change, total), 90: cell(change, total) });
const fixture = { asOfDate: "2026-10-09", rows: [
  { game: "pokemon", set: "Surging Sparks", slug: "surging-sparks", cells: {
    all: windows(15, 2), "illustration-rares": windows(15, 2),
  } },
  { game: "riftbound", set: "Origins", slug: "origins", cells: {
    all: windows(-20, 1), signatures: windows(-20, 1),
  } },
] };

test("Sets heatmap keeps tiles default and supports scoped cells on desktop and phone", async ({ page }) => {
  await page.route("**/api/sets/heatmap", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) }));
  await page.goto("/sets?market=riftbound");
  if (await page.getByText("Sets need the database").count()) test.skip(true, "No seeded local D1");
  await expect(page.getByRole("tab", { name: "Riftbound" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Tiles", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Heatmap", exact: true }).click();
  await expect(page).toHaveURL(/view=heatmap/);
  await expect(page.getByRole("table")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Origins, Signature, 30 day.*-20.0%/ })).toBeVisible();
  await page.getByRole("button", { name: /Origins, Signature, 30 day.*-20.0%/ }).click();
  await expect(page.getByRole("heading", { name: "Origins · Signature" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View matching cards" })).toHaveAttribute("href", /market=riftbound.*sets=Origins.*rarity=signatures/);
  await page.getByRole("button", { name: "7D" }).click();
  await expect(page).toHaveURL(/window=7/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
  const filters = page.locator(".heatmap-filters");
  await filters.locator("summary").click();
  await filters.getByRole("searchbox", { name: "Search sets" }).fill("Missing set");
  await expect(page).not.toHaveURL(/q=Missing/);
  await filters.getByRole("button", { name: "Cancel" }).click();
  await expect(filters).not.toHaveAttribute("open", "");
  await filters.locator("summary").click();
  await filters.getByRole("searchbox", { name: "Search sets" }).fill("Origins");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=Origins/);
  await filters.locator("summary").click();
  await filters.getByRole("button", { name: "Clear all" }).click();
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).not.toHaveURL(/q=/);
  for (const [width, theme] of [[1440, "light"], [390, "dark"]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await expect(page.locator(".heatmap-scroll")).toBeVisible();
    await expect(page.getByText("Scroll sideways to compare rarities")).toBeVisible();
    await page.screenshot({ path: `test-results/heatmap-${width}-${theme}.png`, fullPage: true });
  }
  await page.getByRole("tab", { name: "Pokémon" }).click();
  await expect(page.getByRole("button", { name: /Surging Sparks, Illustration Rare, 30 day.*\+15.0%/ })).toBeVisible();
});
