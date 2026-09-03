"use client";
import {useEffect,useRef} from "react";

// Pointer-tracking tilt on the detail hero art: a deliberate interactive exception to the
// flat-hover rule, recorded in docs/design-baseline.md. Mouse pointers tilt on hover.
// Touch tilts only after a hold (~220ms without the finger wandering) so ordinary
// scrolls over the art stay scrolls; once held, dragging tracks the finger and the
// native touchmove listener below keeps the browser from claiming the drag as a scroll.
// One tilt engine for every pointer kind and both product kinds (card and sealed): the
// engaged art also enlarges slightly (--tilt-scale) while hovered or held.
export function useArtTilt(){
 const artRef=useRef<HTMLDivElement>(null);
 const touchTilt=useRef<{timer:number|null;active:boolean;startX:number;startY:number}>({timer:null,active:false,startX:0,startY:0});
 const applyTilt=(clientX:number,clientY:number)=>{const element=artRef.current;if(!element)return;const rect=element.getBoundingClientRect(),x=(clientX-rect.left)/rect.width-.5,y=(clientY-rect.top)/rect.height-.5;element.style.setProperty("--tilt-x",`${(-y*9).toFixed(2)}deg`);element.style.setProperty("--tilt-y",`${(x*11).toFixed(2)}deg`);element.style.setProperty("--tilt-scale","1.035")};
 const resetTilt=()=>{const element=artRef.current;if(element){element.style.setProperty("--tilt-x","0deg");element.style.setProperty("--tilt-y","0deg");element.style.setProperty("--tilt-scale","1")}};
 const endTouchTilt=()=>{const state=touchTilt.current;if(state.timer!=null){window.clearTimeout(state.timer);state.timer=null}if(state.active){state.active=false;resetTilt()}};
 const onPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{if(event.pointerType==="mouse")return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const state=touchTilt.current;state.startX=event.clientX;state.startY=event.clientY;state.timer=window.setTimeout(()=>{state.timer=null;state.active=true;applyTilt(state.startX,state.startY)},220)};
 const onPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="mouse"){applyTilt(event.clientX,event.clientY);return}
  const state=touchTilt.current;
  if(state.active){applyTilt(event.clientX,event.clientY);return}
  // Finger wandered before the hold matured: it is a scroll, not a tilt — stand down.
  if(state.timer!=null&&Math.hypot(event.clientX-state.startX,event.clientY-state.startY)>12){window.clearTimeout(state.timer);state.timer=null}
 };
 const onPointerLeave=()=>{resetTilt();endTouchTilt()};
 useEffect(()=>{const element=artRef.current;if(!element)return;
  // Non-passive on purpose: while the hold-tilt is live the drag must not scroll the page.
  const onTouchMove=(event:TouchEvent)=>{if(touchTilt.current.active)event.preventDefault()};
  // A matured hold would otherwise pop the long-press menu / image callout.
  const onContextMenu=(event:Event)=>{if(touchTilt.current.active)event.preventDefault()};
  element.addEventListener("touchmove",onTouchMove,{passive:false});
  element.addEventListener("contextmenu",onContextMenu);
  return()=>{element.removeEventListener("touchmove",onTouchMove);element.removeEventListener("contextmenu",onContextMenu)};
 },[]);
 // A tuple, not an object: the React Compiler lint tracks the ref through destructuring
 // but treats a returned object holding a ref as a ref read during render.
 return [artRef,{onPointerDown,onPointerMove,onPointerUp:endTouchTilt,onPointerCancel:endTouchTilt,onPointerLeave}] as const;
}
