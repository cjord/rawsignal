// The crawl map (review §15, crawler cost): the pages worth indexing are the boards, the sets
// directory, the metrics page, and every set page. The 18 k product pages are reachable from
// those and are deliberately not listed — a sitemap of them invites a full-catalog crawl every
// day. Pure so the route stays thin and the output is testable.

export type SitemapSet = { game: string; slug: string };

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] as string);

export function buildSitemap(origin: string, sets: readonly SitemapSet[], lastmod: string | null): string {
  const entries = [
    { path: "/", priority: "1.0" },
    { path: "/?mode=sealed", priority: "0.9" },
    { path: "/sets", priority: "0.9" },
    { path: "/metrics", priority: "0.8" },
    ...sets.map(set => ({ path: `/sets/${set.game}/${set.slug}`, priority: "0.7" })),
  ];
  const stamp = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
  const urls = entries.map(entry => `  <url><loc>${escapeXml(origin + entry.path)}</loc>${stamp}<changefreq>daily</changefreq><priority>${entry.priority}</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
