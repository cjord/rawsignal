"use client";
import type {ReactNode} from "react";
import DeferredImage from "../DeferredImage";

export default function HistoryPopover({className,identityClassName,artClassName,image,alt,badge,children,label}:{className:string;identityClassName:string;artClassName?:string;image?:string|null;alt:string;badge?:ReactNode;children:ReactNode;label:string}){
 return <span className={className} role="region" aria-label={label}><span className={identityClassName}>{artClassName?<span className={artClassName}><DeferredImage src={image} alt={alt}/></span>:<DeferredImage src={image} alt={alt}/>} {badge}</span><span>{children}</span></span>;
}
