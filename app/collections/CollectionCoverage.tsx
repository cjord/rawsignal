"use client";
import {collectionHealth} from '../../core/domain/collection-health';
import type {Holding} from '../../core/domain/owned-collections';
export default function CollectionCoverage({holdings,onFilter}:{holdings:Holding[];onFilter:(health:'missing-price'|'missing-cost')=>void}){
 const health=collectionHealth(holdings);if(!holdings.length||!health.missingPrices&&!health.missingCosts)return null;
 return <aside className="collection-coverage" aria-label="Collection Data Coverage"><strong>Partial Coverage</strong><p>Some figures exclude missing data. These totals describe the selected collection, not only the filtered rows.</p><div>{health.missingPrices>0&&<button className="game-control" onClick={()=>onFilter('missing-price')}>{health.missingPrices} Printings Missing Prices</button>}{health.missingCosts>0&&<button className="game-control" onClick={()=>onFilter('missing-cost')}>{health.missingCosts} Printings Missing Costs</button>}</div></aside>;
}
