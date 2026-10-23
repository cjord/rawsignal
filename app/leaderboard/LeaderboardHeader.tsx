import type {ReactNode} from "react";

export default function LeaderboardHeader({className,kicker,kickerClassName,title,description,summary,aside,ready=true}:{className:string;kicker:string;kickerClassName?:string;title:ReactNode;description?:string;summary:ReactNode;aside?:ReactNode;ready?:boolean}){
 return <div className={className} aria-busy={!ready}><div><p className={kickerClassName}>{ready?kicker:'Market ranking'}</p><h2>{ready?title:'Loading market…'}</h2>{description&&<p>{description}</p>}{ready?summary:<div className="leader-filter-summary" aria-hidden="true"/>}</div>{ready?aside:<span className="section-aside" aria-hidden="true"><span>Loading market data…</span><span>Checking source date…</span></span>}</div>;
}
