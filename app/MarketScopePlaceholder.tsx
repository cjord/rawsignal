export default function MarketScopePlaceholder({kind}:{kind:'sets'|'metrics'}){
 return <section className={`detail-section market-scope-placeholder is-${kind}`} role="status" aria-label="Loading selected market" aria-busy="true"><span className="scope-placeholder-heading" aria-hidden="true"/><div aria-hidden="true">{Array.from({length:6},(_,index)=><span key={index}/>)}</div><noscript><p>Select a market: <a href={`/${kind}?market=pokemon`}>Pokémon</a> · <a href={`/${kind}?market=riftbound`}>Riftbound</a> · <a href={`/${kind}?market=all`}>All markets</a></p></noscript></section>;
}
