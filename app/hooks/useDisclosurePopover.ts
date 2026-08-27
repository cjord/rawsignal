"use client";
import {useCallback,useEffect,useId,useRef,useState,type FocusEvent,type KeyboardEvent,type PointerEvent,type RefObject,type SyntheticEvent} from "react";

// Casual mouse passes across the table shouldn't flash popovers; hover opens after a short dwell.
export const HOVER_OPEN_DELAY_MS=150;

export type PopoverPlacement="above"|"below";
export type PopoverSide="left"|"right";

export function disclosurePlacement(top:number,popupHeight:number,gap=12):PopoverPlacement{return top>=popupHeight+gap?"above":"below"}
export function disclosureSide(right:number,popupWidth:number,viewportWidth:number):PopoverSide{return right+popupWidth>viewportWidth?"left":"right"}

export default function useDisclosurePopover({rootRef,panelRef,minimumHeight=320,popupWidth=430}:{rootRef:RefObject<HTMLDetailsElement|null>;panelRef:RefObject<HTMLElement|null>;minimumHeight?:number;popupWidth?:number}){
 const id=useId(),[open,setOpen]=useState(false),[placement,setPlacement]=useState<PopoverPlacement>("above"),[side,setSide]=useState<PopoverSide>("right");
 const supportsHover=()=>typeof window!=="undefined"&&window.matchMedia("(hover: hover) and (pointer: fine)").matches;
 const measure=useCallback(()=>{const root=rootRef.current,panel=panelRef.current;if(!root)return;const rect=root.getBoundingClientRect(),height=Math.max(panel?.scrollHeight??0,minimumHeight);setPlacement(disclosurePlacement(rect.top,height));setSide(disclosureSide(rect.right,popupWidth,window.innerWidth))},[minimumHeight,panelRef,popupWidth,rootRef]);
 const reveal=useCallback(()=>{setOpen(true);requestAnimationFrame(measure)},[measure]);
 const hoverTimerRef=useRef<number|null>(null);
 const cancelHoverTimer=useCallback(()=>{if(hoverTimerRef.current!=null){window.clearTimeout(hoverTimerRef.current);hoverTimerRef.current=null}},[]);
 useEffect(()=>cancelHoverTimer,[cancelHoverTimer]);
 const onPointerEnter=(event:PointerEvent<HTMLDetailsElement>)=>{if(event.pointerType==="mouse"&&supportsHover()){cancelHoverTimer();hoverTimerRef.current=window.setTimeout(()=>{hoverTimerRef.current=null;reveal()},HOVER_OPEN_DELAY_MS)}};
 // relatedTarget can be the Window (or other non-Node) when the pointer or focus exits the page; contains() rejects those.
 const containsRelated=(event:{currentTarget:HTMLDetailsElement;relatedTarget:EventTarget|null})=>event.relatedTarget instanceof Node&&event.currentTarget.contains(event.relatedTarget);
 const onPointerLeave=(event:PointerEvent<HTMLDetailsElement>)=>{if(event.pointerType==="mouse"&&supportsHover()&&!containsRelated(event)){cancelHoverTimer();setOpen(false)}};
 const onFocusCapture=()=>reveal();
 const onBlurCapture=(event:FocusEvent<HTMLDetailsElement>)=>{if(!containsRelated(event))setOpen(false)};
 const onKeyDown=(event:KeyboardEvent<HTMLDetailsElement>)=>{if(event.key!=="Escape")return;event.preventDefault();setOpen(false);rootRef.current?.querySelector("summary")?.focus()};
 const onToggle=(event:SyntheticEvent<HTMLDetailsElement>)=>setOpen(event.currentTarget.open);
 const onSummaryClick=(event:{detail:number;preventDefault:()=>void;target?:EventTarget|null})=>{if((event.target as Element|null)?.closest?.("a[href]"))return;if(event.detail>0&&supportsHover())event.preventDefault()};
 return{id,panelId:`market-popover-${id.replace(/:/g,"")}`,open,reveal,placement,side,supportsHover,detailsProps:{open,onToggle,onPointerEnter,onPointerLeave,onFocusCapture,onBlurCapture,onKeyDown},summaryProps:{onClick:onSummaryClick}};
}
