"use client";
import type {ReactNode} from "react";
import DeferredImage from "../DeferredImage";

// Favorite stars live on the rows/tiles themselves (visual pass 2026-08-28); the popover
// stays a pure inspection surface.
export default function HistoryPopover({className,identityClassName,artClassName,image,alt,badge,children,label}:{className:string;identityClassName:string;artClassName?:string;image?:string|null;alt:string;badge?:ReactNode;children:ReactNode;label:string}){
 return <span className={className} role="region" aria-label={label}><span className={identityClassName}>{artClassName?<span className={artClassName}><DeferredImage src={image} alt={alt}/></span>:<DeferredImage src={image} alt={alt}/>} {badge}</span><span>{children}</span></span>;
}
