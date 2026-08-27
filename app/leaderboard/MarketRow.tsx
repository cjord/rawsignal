"use client";
import {useRef,type ReactNode} from "react";
import useDisclosurePopover from "../hooks/useDisclosurePopover";

export default function MarketRow({className,children,popover,label,href,popupWidth=430}:{className:string;children:ReactNode;popover:ReactNode;label:string;href:string;popupWidth?:number}){
 const rootRef=useRef<HTMLDetailsElement>(null),panelRef=useRef<HTMLSpanElement>(null),disclosure=useDisclosurePopover({rootRef,panelRef,popupWidth});
 const onDetailClick=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(disclosure.supportsHover())return;if(!disclosure.open){event.preventDefault();disclosure.reveal()}};
 return <details ref={rootRef} {...disclosure.detailsProps} className={`market-row-shell ${disclosure.open?"is-open":""}`} data-popup-place={disclosure.placement} data-expand={disclosure.side}><summary {...disclosure.summaryProps} className={className} aria-controls={disclosure.panelId}>{children}<a className="market-row-detail-link" href={href} aria-label={label} onClick={onDetailClick}/></summary><span ref={panelRef} className="market-row-popover" id={disclosure.panelId}>{popover}</span></details>;
}
