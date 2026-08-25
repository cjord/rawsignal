"use client";
import {useRef,type ReactNode} from "react";
import useDisclosurePopover from "../hooks/useDisclosurePopover";

export default function MarketRow({className,children,popover,label,popupWidth=430}:{className:string;children:ReactNode;popover:ReactNode;label:string;popupWidth?:number}){
 const rootRef=useRef<HTMLDetailsElement>(null),panelRef=useRef<HTMLSpanElement>(null),disclosure=useDisclosurePopover({rootRef,panelRef,popupWidth});
 return <details ref={rootRef} {...disclosure.detailsProps} className={`market-row-shell ${disclosure.open?"is-open":""}`} data-popup-place={disclosure.placement} data-expand={disclosure.side}><summary {...disclosure.summaryProps} className={className} aria-controls={disclosure.panelId} aria-label={label}>{children}</summary><span ref={panelRef} className="market-row-popover" id={disclosure.panelId}>{popover}</span></details>;
}
