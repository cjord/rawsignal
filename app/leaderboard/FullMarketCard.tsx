"use client";
import type {ReactNode} from "react";
import DeferredImage from "../DeferredImage";

export default function FullMarketCard({className,artClassName,dataClassName,titleClassName,image,alt,title,meta,secondary,rank,content,history,historyClassName}:{className:string;artClassName:string;dataClassName:string;titleClassName:string;image?:string|null;alt:string;title:string;meta:ReactNode;secondary?:ReactNode;rank?:number;content:ReactNode;history?:ReactNode;historyClassName?:string}){
 return <article className={className}>{rank!=null&&<span className="position">{String(rank).padStart(2,"0")}</span>}<span className={artClassName}><DeferredImage src={image} alt={alt}/></span><span className={dataClassName}><span className={titleClassName}><b>{title}</b><small>{meta}</small>{secondary}</span>{content}</span>{history&&<span className={historyClassName}>{history}</span>}</article>;
}
