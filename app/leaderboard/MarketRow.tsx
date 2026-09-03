"use client";
import {useEffect,useRef,type ReactNode} from "react";
import useDisclosurePopover from "../hooks/useDisclosurePopover";
import {useHoverPreviews} from "../state/hover-previews";
import {warmDetailPage} from "./detail-prefetch";

export default function MarketRow({className,children,popover,label,href,popupWidth=430,onReveal}:{className:string;children:ReactNode;popover:ReactNode;label:string;href:string;popupWidth?:number;onReveal?:()=>void}){
 const hoverPreviews=useHoverPreviews();
 const rootRef=useRef<HTMLDetailsElement>(null),panelRef=useRef<HTMLSpanElement>(null),disclosure=useDisclosurePopover({rootRef,panelRef,popupWidth});
 useEffect(()=>{if(hoverPreviews&&disclosure.open)warmDetailPage(href)},[hoverPreviews,disclosure.open,href]);
 // The chart inside the popover loads its history on first reveal (review §14 follow-up):
 // rows render their columns from feed metrics, so nothing is fetched until a row opens.
 useEffect(()=>{if(disclosure.open)onReveal?.()},[disclosure.open,onReveal]);
 // Touch tap model (todo N1): tapping the row only TOGGLES the chart popup — a second
 // tap closes it instead of navigating (accidental navigations were the old behavior).
 // Navigation on touch happens through the explicit "View details" button rendered in
 // the popup below; desktop hover behavior is unchanged (hover previews, click opens).
 const onDetailClick=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(!hoverPreviews)return;if(disclosure.supportsHover())return;event.preventDefault();if(disclosure.open)disclosure.dismiss();else disclosure.reveal()};
 // With previews off, the shell is inert chrome: no disclosure handlers, no popover markup, every click navigates.
 const shellProps=hoverPreviews?disclosure.detailsProps:{};
 const summaryProps=hoverPreviews?disclosure.summaryProps:{onClick:(event:React.MouseEvent)=>event.preventDefault()};
 return <details ref={rootRef} {...shellProps} className={`market-row-shell ${hoverPreviews&&disclosure.open?"is-open":""}`} data-popup-place={disclosure.placement} data-expand={disclosure.side}><summary {...summaryProps} className={className} aria-controls={hoverPreviews?disclosure.panelId:undefined}>{children}<a className="market-row-detail-link" href={href} aria-label={label} onClick={onDetailClick}/></summary>{hoverPreviews&&<span ref={panelRef} className="market-row-popover" id={disclosure.panelId}>{popover}<a className="market-row-open" href={href}>View details →</a></span>}</details>;
}
