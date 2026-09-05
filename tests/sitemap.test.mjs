import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSitemap } from "../core/sitemap.ts";

test("the sitemap lists the core pages and every set page, dated by the published run, and escapes XML", () => {
  const xml = buildSitemap("https://rawsignal.cards", [{ game: "pokemon", slug: "sv-prismatic-evolutions" }, { game: "riftbound", slug: "origins" }], "2026-09-04");
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  for (const path of ["/", "/?mode=sealed", "/sets", "/metrics", "/sets/pokemon/sv-prismatic-evolutions", "/sets/riftbound/origins"]) {
    assert.ok(xml.includes(`<loc>https://rawsignal.cards${path}</loc>`), `lists ${path}`);
  }
  assert.equal((xml.match(/<lastmod>2026-09-04<\/lastmod>/g) ?? []).length, 6);
  assert.equal((xml.match(/<url>/g) ?? []).length, 6);
  // Product pages are reachable from the set pages and are not listed.
  assert.equal(xml.includes("/cards/"), false);
  assert.ok(xml.trimEnd().endsWith("</urlset>"));
  // Special characters in an origin or slug are escaped, and a missing publish date omits lastmod.
  const odd = buildSitemap("https://a.test", [{ game: "pokemon", slug: "a&b" }], null);
  assert.ok(odd.includes("<loc>https://a.test/sets/pokemon/a&amp;b</loc>"));
  assert.equal(odd.includes("<lastmod>"), false);
});

test("robots.txt keeps crawlers off the feeds, the API, and the tooling paths, and points at the sitemap", async () => {
  const robots = await readFile(new URL("../public/robots.txt", import.meta.url), "utf8");
  const lines = robots.split(/\r?\n/).map(line => line.trim());
  for (const path of ["/api/", "/data/", "/_vinext/", "/__ops/"]) assert.ok(lines.includes(`Disallow: ${path}`), `disallows ${path}`);
  // The product, set, and board pages stay crawlable.
  assert.equal(lines.some(line => /^Disallow: \/(cards|sealed|sets|metrics)/.test(line)), false);
  assert.ok(lines.includes("Sitemap: https://rawsignal.cards/sitemap.xml"));
  assert.ok(lines.some(line => /^Crawl-delay: \d+$/.test(line)));
});
