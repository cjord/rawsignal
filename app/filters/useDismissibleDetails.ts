"use client";
import {useEffect,useRef} from "react";

export default function useDismissibleDetails(){
 const root=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const onPointerDown=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))root.current.open=false};const onKeyDown=(event:KeyboardEvent)=>{if(event.key!=="Escape"||!root.current?.open)return;root.current.open=false;root.current.querySelector("summary")?.focus()};document.addEventListener("pointerdown",onPointerDown);document.addEventListener("keydown",onKeyDown);return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown)}},[]);
 return root;
}
