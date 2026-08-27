"use client";
import {useId,useRef,useState,type ReactNode} from "react";
import {infoHintAlignment,type InfoHintAlign} from "./hooks/info-hint";

// Explanatory copy sits behind an ⓘ toggletip (todo D3): hover/keyboard-focus reveal via CSS,
// tap-to-toggle for touch. The text stays in the DOM so aria-describedby announces it even
// while the bubble is display:none.
export default function InfoHint({label,children}:{label:string;children:ReactNode}){
 const id=useId(),tipId=`info-hint-${id.replace(/:/g,"")}`;
 const rootRef=useRef<HTMLSpanElement>(null);
 const [open,setOpen]=useState(false),[align,setAlign]=useState<InfoHintAlign>("center");
 const measure=()=>{const rect=rootRef.current?.getBoundingClientRect();if(rect)setAlign(infoHintAlignment(rect.left+rect.width/2,window.innerWidth))};
 return <span ref={rootRef} className="info-hint" data-align={align} data-open={open||undefined} onPointerEnter={measure}>
  <button type="button" aria-label={label} aria-describedby={tipId} aria-expanded={open} onFocus={measure} onClick={()=>{measure();setOpen(value=>!value)}} onBlur={()=>setOpen(false)} onKeyDown={event=>{if(event.key==="Escape")setOpen(false)}}>i</button>
  <span role="tooltip" id={tipId}>{children}</span>
 </span>;
}
