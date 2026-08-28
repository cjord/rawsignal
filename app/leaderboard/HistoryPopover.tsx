"use client";
import type {ReactNode} from "react";
import DeferredImage from "../DeferredImage";
import FavoriteStar from "../FavoriteStar";
import type {FavoriteEntry} from "../state/favorites";

// The hover popover is where the row star lives (user decision 2026-08-28): rows stay
// clutter-free and the star appears exactly when someone is inspecting a product.
export default function HistoryPopover({className,identityClassName,artClassName,image,alt,badge,favorite,children,label}:{className:string;identityClassName:string;artClassName?:string;image?:string|null;alt:string;badge?:ReactNode;favorite?:FavoriteEntry;children:ReactNode;label:string}){
 return <span className={className} role="region" aria-label={label}>{favorite&&<FavoriteStar entry={favorite} className="popover-star"/>}<span className={identityClassName}>{artClassName?<span className={artClassName}><DeferredImage src={image} alt={alt}/></span>:<DeferredImage src={image} alt={alt}/>} {badge}</span><span>{children}</span></span>;
}
