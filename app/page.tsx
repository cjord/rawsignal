"use client";
import { useMemo, useState } from "react";
import data from "../tcg-data.json";

type Game = "pokemon" | "riftbound";
type Card = (typeof data.sections)[keyof typeof data.sections][number];
const gameSections = {
  pokemon: [
    ["vintage", "Vintage"], ["illustration-rares", "Illustration Rares"], ["special-illustration-rares", "Special Illustration Rares"],
  ],
  riftbound: [
    ["rares", "Rares"], ["epics", "Epics"], ["alt-arts", "Alt Arts"], ["overnumbered", "Overnumbered"], ["signatures", "Signatures"],
  ],
} as const;
const usd = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);
const date = new Date(data.sourceUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Home() {
  const [game, setGame] = useState<Game>("pokemon");
  const [section, setSection] = useState("vintage");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("market");
  const sections = gameSections[game];
  const label = sections.find(([key]) => key === section)?.[1] ?? sections[0][1];
  const cards = useMemo(() => {
    const source = (data.sections[section as keyof typeof data.sections] ?? []) as Card[];
    const q = query.trim().toLowerCase();
    return source.filter((card) => !q || `${card.name} ${card.set} ${card.number}`.toLowerCase().includes(q)).sort((a, b) => sort === "low" ? (a.lowPrice ?? Infinity) - (b.lowPrice ?? Infinity) : sort === "name" ? a.name.localeCompare(b.name) : b.marketPrice - a.marketPrice);
  }, [section, query, sort]);
  const switchGame = (next: Game) => { setGame(next); setSection(gameSections[next][0][0]); setQuery(""); };

  return <main>
    <nav className="topbar"><a className="brand" href="#top"><span>R</span> Raw Signal</a><div className="toplinks"><a href="#leaderboard">Rankings</a><a href="#method">Method</a></div></nav>
    <header className="masthead" id="top">
      <p className="kicker">Daily TCG market intelligence</p>
      <h1>The card market,<br/><span>without the noise.</span></h1>
      <p className="dek">Price leaderboards for Pokémon and Riftbound, built from TCGCSV’s daily TCGplayer product and market-price snapshot.</p>
      <div className="game-switch" role="tablist" aria-label="Trading card game">
        <button className={game === "pokemon" ? "active pokemon" : ""} onClick={() => switchGame("pokemon")} role="tab">Pokémon</button>
        <button className={game === "riftbound" ? "active riftbound" : ""} onClick={() => switchGame("riftbound")} role="tab">Riftbound</button>
      </div>
    </header>

    <section className={`market-strip ${game}`}>
      <div><span>Market</span><strong>{game === "pokemon" ? "Pokémon" : "Riftbound"}</strong></div>
      <div><span>Category</span><strong>{label}</strong></div>
      <div><span>Cards ranked</span><strong>{cards.length}</strong></div>
      <div><span>Source updated</span><strong>{date}</strong></div>
    </section>

    <section className="category-rail" aria-label={`${game} categories`}>
      {sections.map(([key, name]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>{name}</button>)}
    </section>

    <section className="leaderboard" id="leaderboard">
      <div className="section-heading"><div><p>{game} market ranking</p><h2>{label} Leaderboard</h2></div><span>Top cards by TCGplayer market price</span></div>
      <div className="controls"><label><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search card, set, or number" aria-label="Search cards"/></label><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort leaderboard"><option value="market">Market price: high to low</option><option value="low">Lowest listing first</option><option value="name">Card name: A–Z</option></select></div>
      <div className="table-head"><span>Rank</span><span>Card</span><span>Set</span><span>Printing</span><span>Low</span><span>Market</span></div>
      <div className="rows">{cards.map((card, index) => <a className="leader-row" href={card.url} target="_blank" rel="noreferrer" key={`${card.productId}-${card.section}`}>
        <span className="position">{String(index + 1).padStart(2, "0")}</span>
        <span className="identity"><img src={card.image} alt="" loading="lazy"/><span><b>{card.name}</b><small>{card.number} · {card.rarity}</small></span></span>
        <span className="set-name">{card.set}<small>{card.year}</small></span>
        <span className="printing">{card.printing}</span>
        <span className="low">{usd(card.lowPrice)}</span>
        <span className="market-price">{usd(card.marketPrice)}<small>TCG market</small></span>
        <span className="arrow">↗</span>
      </a>)}</div>
      {!cards.length && <div className="empty">No cards match that search.</div>}
    </section>

    <section className="method" id="method"><p className="kicker">The methodology</p><h2>A clean daily snapshot.</h2><div className="method-grid"><p><b>Source</b> TCGCSV publishes a cached export of TCGplayer categories, sets, products, and market prices once per day. This site ingests that snapshot server-side.</p><p><b>Pokémon</b> Vintage includes sets published through 2010. Illustration Rare and Special Illustration Rare use TCGplayer’s exact rarity field.</p><p><b>Riftbound</b> Rare and Epic use exact rarity fields. Alt Art, Overnumbered, and Signature use the card-name and numbering conventions in TCGCSV.</p></div></section>
    <footer><a className="brand" href="#top"><span>R</span> Raw Signal</a><p>Market data from <a href="https://tcgcsv.com/" target="_blank" rel="noreferrer">TCGCSV</a>. Prices are informational, may lag, and do not include shipping or condition-level detail.</p></footer>
  </main>;
}
