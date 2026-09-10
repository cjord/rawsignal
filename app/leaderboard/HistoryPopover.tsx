"use client";
import type {ReactNode} from "react";
import DeferredImage from "../DeferredImage";
import type {HistoryMetric} from "../../core/domain/types";

// Favorite stars live on the rows/tiles themselves (visual pass 2026-08-28); the popover
// stays a pure inspection surface. Outbound marketplace tiles (`links`, todo O3) sit under
// the artwork so the stats grid stays market data only.
export default function HistoryPopover({className,identityClassName,artClassName,image,fallback,alt,badge,links,children,label}:{className:string;identityClassName:string;artClassName?:string;image?:string|null;fallback?:string|null;alt:string;badge?:ReactNode;links?:HistoryMetric[];children:ReactNode;label:string}){
 return <span className={className} role="region" aria-label={label}><span className={identityClassName}>{artClassName?<span className={artClassName}><DeferredImage src={image} fallback={fallback} alt={alt}/></span>:<DeferredImage src={image} fallback={fallback} alt={alt}/>} {badge}{links?.length?<span className="hover-card-links">{links.map(link=><a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer sponsored"><small>{link.label}</small><b>{link.value}</b></a>)}</span>:null}</span><span>{children}</span></span>;
}
