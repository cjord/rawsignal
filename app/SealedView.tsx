"use client";
import { useEffect, useMemo, useState } from "react";

type Game="pokemon"|"riftbound"|"magic";
type Product={game:Game;productId:number;name:string;set:string;category:string;image:string;url:string;msrp:number;marketPrice:number;midPrice:number|null;profit:number;profitPct:number;msrpSource:string};
const games:Record<Game,string>={pokemon:"Pokémon",riftbound:"Riftbound",magic:"Magic: The Gathering"};
const usd=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?0:2}).format(value);

export default function SealedView(){
 const [game,setGame]=useState<Game>("pokemon"),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true),[query,setQuery]=useState(""),[category,setCategory]=useState("all"),[sort,setSort]=useState("profitPct"),[perPage,setPerPage]=useState(20),[page,setPage]=useState(1);
 useEffect(()=>{let active=true;setLoading(true);fetch(`/data/sealed-${game}.json`).then(response=>response.json()).then(data=>{if(active){setProducts(data);setLoading(false);setPage(1);setCategory("all")}});return()=>{active=false}},[game]);
 const categories=useMemo(()=>[...new Set(products.map(product=>product.category))].sort(),[products]);
 const filtered=useMemo(()=>{const needle=query.trim().toLowerCase();return products.filter(product=>(category==="all"||product.category===category)&&(!needle||`${product.name} ${product.set}`.toLowerCase().includes(needle))).sort((a,b)=>sort==="market"?b.marketPrice-a.marketPrice:sort==="msrp"?b.msrp-a.msrp:sort==="profit"?b.profit-a.profit:sort==="name"?a.name.localeCompare(b.name):b.profitPct-a.profitPct)},[products,category,query,sort]);
 const pages=Math.max(1,Math.ceil(filtered.length/perPage)),visible=filtered.slice((page-1)*perPage,page*perPage);
 return <section className="sealed-market" id="sealed-market">
  <div className="sealed-summary"><div><p className="kicker">Sealed product intelligence</p><h2>{games[game]} Sealed</h2><p>Verified MSRP compared with the current TCGplayer market value.</p></div><div className="sealed-count"><strong>{filtered.length}</strong><span>products tracked</span></div></div>
  <div className="sealed-controls">
   <label><span>Market</span><select value={game} onChange={event=>setGame(event.target.value as Game)}><option value="pokemon">Pokémon</option><option value="riftbound">Riftbound</option><option value="magic">Magic: The Gathering</option></select></label>
   <label><span>Category</span><select value={category} onChange={event=>{setCategory(event.target.value);setPage(1)}}><option value="all">All categories</option>{categories.map(value=><option key={value}>{value}</option>)}</select></label>
   <label className="sealed-search"><span>Search</span><input value={query} onChange={event=>{setQuery(event.target.value);setPage(1)}} placeholder="Search product or set"/></label>
   <label><span>Sort</span><select value={sort} onChange={event=>setSort(event.target.value)}><option value="profitPct">Profit %</option><option value="profit">Profit $</option><option value="market">Market value</option><option value="msrp">MSRP</option><option value="name">Product name</option></select></label>
   <label><span>Per page</span><select value={perPage} onChange={event=>{setPerPage(Number(event.target.value));setPage(1)}}><option>20</option><option>30</option><option>40</option><option>50</option></select></label>
  </div>
  <div className="sealed-head"><span>Product</span><span>Category</span><span>MSRP</span><span>Market</span><span>Profit</span><span>Profit %</span></div>
  <div className="sealed-rows">{loading?<div className="empty">Loading sealed products…</div>:visible.map(product=><a className="sealed-row" href={product.url} target="_blank" rel="noreferrer" key={product.productId}><span className="sealed-product"><img src={product.image} alt="" loading="lazy"/><span><b>{product.name}</b><small>{product.set}</small></span></span><span className="sealed-category">{product.category}</span><span data-label="MSRP"><b>{usd(product.msrp)}</b><small>{product.msrpSource}</small></span><span data-label="Market"><b>{usd(product.marketPrice)}</b><small>TCGplayer market</small></span><span data-label="Profit" className={product.profit>=0?"profit-positive":"profit-negative"}><b>{product.profit>=0?"+":""}{usd(product.profit)}</b></span><span data-label="Profit %"><b className={`profit-pill ${product.profitPct>=0?"positive":"negative"}`}>{product.profitPct>=0?"+":""}{product.profitPct.toFixed(1)}%</b></span></a>)}</div>
  {!loading&&<div className="pagination"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>← Previous</button><span>Page <b>{page}</b> of {pages}</span><button disabled={page===pages} onClick={()=>setPage(value=>value+1)}>Next →</button></div>}
  <p className="sealed-note">Profit is market value minus MSRP, before tax, shipping, marketplace fees, or condition adjustments. Only products with a published or documented US MSRP are included.</p>
 </section>
}
