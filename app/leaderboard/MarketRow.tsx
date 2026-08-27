"use client";
import {useEffect,useRef,type ReactNode} from "react";
import useDisclosurePopover from "../hooks/useDisclosurePopover";
import {useHoverPreviews} from "../state/hover-previews";
import {warmDetailPage} from "./detail-prefetch";

export default function MarketRow({className,children,popover,label,href,popupWidth=430}:{className:string;children:ReactNode;popover:ReactNode;label:string;href:string;popupWidth?:number}){
 const hoverPreviews=useHoverPreviews();
 const rootRef=useRef<HTMLDetailsElement>(null),panelRef=useRef<HTMLSpanElement>(null),disclosure=useDisclosurePopover({rootRef,panelRef,popupWidth});
 useEffect(()=>{if(hoverPreviews&&disclosure.open)warmDetailPage(href)},[hoverPreviews,disclosure.open,href]);
 const onDetailClick=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(!hoverPreviews)return;if(disclosure.supportsHover())return;if(!disclosure.open){event.preventDefault();disclosure.reveal()}};
 // With previews off, the shell is inert chrome: no disclosure handlers, no popover markup, every click navigates.
 const shellProps=hoverPreviews?disclosure.detailsProps:{};
 const summaryProps=hoverPreviews?disclosure.summaryProps:{onClick:(event:React.MouseEvent)=>event.preventDefault()};
 return <details ref={rootRef} {...shellProps} className={`market-row-shell ${hoverPreviews&&disclosure.open?"is-open":""}`} data-popup-place={disclosure.placement} data-expand={disclosure.side}><summary {...summaryProps} className={className} aria-controls={hoverPreviews?disclosure.panelId:undefined}>{children}<a className="market-row-detail-link" href={href} aria-label={label} onClick={onDetailClick}/></summary>{hoverPreviews&&<span ref={panelRef} className="market-row-popover" id={disclosure.panelId}>{popover}</span>}</details>;
}
