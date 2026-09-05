"use client";
import type {ReactNode} from "react";
import DeferredImage from "../DeferredImage";

export default function ProductIdentity({className,image,fallback,alt,title,meta,badge}:{className:string;image?:string|null;fallback?:string|null;alt:string;title:string;meta:ReactNode;badge?:ReactNode}){
 return <span className={className}><DeferredImage src={image} fallback={fallback} alt={alt}/><span><b>{title}</b><small>{meta}</small>{badge}</span></span>;
}
