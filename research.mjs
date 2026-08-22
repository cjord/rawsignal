import fs from 'node:fs/promises';

const sets = [
  'pokemon-evolving-skies',
  'pokemon-brilliant-stars',
  'pokemon-lost-origin',
  'pokemon-silver-tempest',
  'pokemon-crown-zenith',
  'pokemon-paldea-evolved',
  'pokemon-151',
  'pokemon-paradox-rift',
  'pokemon-temporal-forces',
  'pokemon-twilight-masquerade',
  'pokemon-surging-sparks',
  'pokemon-xy-evolutions',
  'pokemon-cosmic-eclipse',
];

const headers = { 'user-agent': 'Mozilla/5.0 (compatible; personal market research)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.text();
    await sleep(500 * (i + 1));
  }
  throw new Error(`Failed ${url}`);
}
const clean = (s='') => s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const money = (s) => Number(String(s).replace(/[^0-9.]/g,''));

async function setUrls(slug) {
  const html = await get(`https://www.pricecharting.com/console/${slug}?exclude-variants=false&show-images=true`);
  const found = [...html.matchAll(/href="(\/game\/[^"]+)"/g)].map(m => new URL(m[1], 'https://www.pricecharting.com').href);
  return [...new Set(found)].filter(u => u.includes(`/${slug.replace('pokemon-','pokemon-')}/`));
}

function parseCard(html, url) {
  const title = clean((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]);
  const chartRaw = (html.match(/VGPC\.chart_data\s*=\s*(\{[\s\S]*?\});/i)||[])[1];
  if (!chartRaw || !title) return null;
  const chart = JSON.parse(chartRaw);
  const rawSeries = chart.used || chart.loose || chart.ungraded;
  if (!Array.isArray(rawSeries) || rawSeries.length < 2) return null;
  const nonzero = rawSeries.filter(p => p[1] > 0);
  const latest = nonzero.at(-1)?.[1] / 100;
  const cutoff = Date.now() - 366 * 86400000;
  const trailing = nonzero.filter(p => p[0] >= cutoff);
  const high = Math.max(...trailing.map(p => p[1])) / 100;
  const pctFromHigh = Math.round((1 - latest / high) * 100);
  const ogImage = (html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)||html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)||html.match(/<img[^>]+src=['"]([^'"]+)['"][^>]+itemprop="image"/i)||[])[1];
  const tcgId = clean((html.match(/TCGPlayer ID:[\s\S]{0,300}?>(\d{4,})</i)||[])[1]);
  const release = clean((html.match(/Release Date:[\s\S]{0,250}?<td[^>]*>([\s\S]*?)<\/td>/i)||[])[1]);
  const setSlug = new URL(url).pathname.split('/')[2] || '';
  const setName = setSlug.replace(/^pokemon-/,'').split('-').map(w => w.toUpperCase()==='Xy'?'XY':w[0]?.toUpperCase()+w.slice(1)).join(' ');
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => clean(m[1]));
  const tcgSales = rows.filter(r => /TCGPlayer/i.test(r) && /Near Mint/i.test(r) && /20\d\d-\d\d-\d\d/.test(r));
  const dated = tcgSales.map(r => r.match(/20\d\d-\d\d-\d\d/)?.[0]).filter(Boolean);
  const newest = dated.sort().at(-1);
  const start = newest ? new Date(newest + 'T00:00:00Z').getTime() - 30 * 86400000 : 0;
  const sales30 = dated.filter(d => new Date(d + 'T00:00:00Z').getTime() >= start).length;
  const volume = sales30 >= 12 ? 'High' : sales30 >= 4 ? 'Medium' : 'Low';
  const tcgMarketMatch = html.match(/TCGPlayer[\s\S]{0,250}?\$([0-9,.]+)/i);
  const tcgMarket = tcgMarketMatch ? money(tcgMarketMatch[1]) : null;
  return { title: title.replace(/ Prices.*$/,''), set: setName, release, current: latest, recentHigh: high, pctFromHigh, sales30, volume, image: ogImage, pricecharting: url, tcgplayer: tcgId ? `https://www.tcgplayer.com/product/${tcgId}?Language=English` : null, tcgMarket };
}

const urls = [];
for (const set of sets) {
  try { urls.push(...await setUrls(set)); } catch (e) { console.error(e.message); }
  await sleep(120);
}
const unique = [...new Set(urls)];
console.error(`candidates ${unique.length}`);
const cards = [];
for (let i = 0; i < unique.length; i += 24) {
  const batch = unique.slice(i, i + 24);
  const vals = await Promise.all(batch.map(async u => { try { return parseCard(await get(u), u); } catch { return null; } }));
  cards.push(...vals.filter(Boolean));
  console.error(`${Math.min(i+24, unique.length)}/${unique.length}`);
  await sleep(150);
}
const eligible = cards.filter(c => c.current >= 1.5 && c.current <= 75 && c.pctFromHigh >= 10 && c.image && c.tcgplayer);
eligible.sort((a,b) => b.pctFromHigh-a.pctFromHigh || b.sales30-a.sales30);
const selected = [];
const perSet = new Map();
for (const c of eligible) {
  const n = perSet.get(c.set) || 0;
  if (n >= 7) continue;
  selected.push(c); perSet.set(c.set, n+1);
  if (selected.length === 50) break;
}
await fs.writeFile('cards.json', JSON.stringify({generatedAt:new Date().toISOString(), methodology:{highWindow:'Trailing 12 months of PriceCharting ungraded monthly values',volume:'TCGplayer Near Mint sales visible in the latest 30-day window: High 12+, Medium 4–11, Low 0–3'},cards:selected}, null, 2));
console.log(JSON.stringify({all:cards.length,eligible:eligible.length,selected:selected.length,sets:Object.fromEntries(perSet)},null,2));
