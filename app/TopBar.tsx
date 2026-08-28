"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-html-link-for-pages -- display preferences sync from the pre-hydration dataset after mount; nav links are plain anchors so the leaderboard re-parses their full query state */
import {useEffect,useRef,useState,type ReactNode} from "react";
import {StrictnessControl} from "./SignalControls";
import {setHoverPreviews,useHoverPreviews} from "./state/hover-previews";
import type {SignalStrictness} from "./domain/types";

const marketLinks=[
 {key:"pokemon",label:"Pokémon",href:"/?mode=singles&market=pokemon"},
 {key:"riftbound",label:"Riftbound",href:"/?mode=singles&market=riftbound"},
 {key:"sealed",label:"Sealed",href:"/?mode=sealed"},
 {key:"metrics",label:"Metrics",href:"/metrics"},
] as const;
export type TopBarActive=(typeof marketLinks)[number]["key"]|null;

export default function TopBar({active=null,actions,strictness,onStrictness,settingsExtra,className=""}:{active?:TopBarActive;actions?:ReactNode;strictness:SignalStrictness;onStrictness:(value:SignalStrictness)=>void;settingsExtra?:ReactNode;className?:string}){
 const [theme,setTheme]=useState<"dark"|"light">("dark");
 const [fontSize,setFontSize]=useState<"default"|"large">("default");
 const [settingsOpen,setSettingsOpen]=useState(false),settingsRef=useRef<HTMLDivElement>(null);
 const hoverPreviews=useHoverPreviews();
 useEffect(()=>{
  setTheme(document.documentElement.dataset.theme==="light"?"light":"dark");
  setFontSize(document.documentElement.dataset.fontSize==="large"?"large":"default");
 },[]);
 useEffect(()=>{
  if(!settingsOpen)return;
  const close=(event:PointerEvent)=>{if(!settingsRef.current?.contains(event.target as Node))setSettingsOpen(false)};
  window.addEventListener("pointerdown",close);
  return()=>window.removeEventListener("pointerdown",close);
 },[settingsOpen]);
 const toggleTheme=()=>setTheme(current=>{const next=current==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("raw-signal-theme",next);return next});
 const changeFontSize=(next:"default"|"large")=>{setFontSize(next);document.documentElement.dataset.fontSize=next;localStorage.setItem("raw-signal-font-size",next)};
 return <nav className={`topbar ${className}`.trim()}>
  <a className="brand" href="/"><span>R</span> Raw Signal</a>
  <div className="toplinks">
   {marketLinks.map(item=><a key={item.key} href={item.href} className={active===item.key?"active":""} aria-current={active===item.key?"page":undefined}>{item.label}</a>)}
   {actions}
   <div className="display-settings" ref={settingsRef}>
    <button type="button" className="settings-toggle" onClick={()=>setSettingsOpen(value=>!value)} aria-label="Display settings" aria-expanded={settingsOpen} aria-haspopup="menu"><span aria-hidden="true">⚙</span></button>
    {settingsOpen&&<div className="settings-menu" role="menu" aria-label="Display settings">
     <span>Font size</span>
     <div className="font-size-options" role="group" aria-label="Font size">
      <button type="button" className={fontSize==="default"?"active":""} aria-pressed={fontSize==="default"} onClick={()=>changeFontSize("default")}><b>Aa</b><small>Default</small></button>
      <button type="button" className={fontSize==="large"?"active":""} aria-pressed={fontSize==="large"} onClick={()=>changeFontSize("large")}><b>Aa</b><small>Larger</small></button>
     </div>
     <span className="settings-section-title">Signals</span>
     <StrictnessControl value={strictness} onChange={onStrictness}/>
     <span className="settings-section-title">Hover previews</span>
     <div className="font-size-options" role="group" aria-label="Hover previews">
      <button type="button" className={hoverPreviews?"active":""} aria-pressed={hoverPreviews} onClick={()=>setHoverPreviews(true)}><b>On</b><small>Charts on hover</small></button>
      <button type="button" className={hoverPreviews?"":"active"} aria-pressed={!hoverPreviews} onClick={()=>setHoverPreviews(false)}><b>Off</b><small>No popups</small></button>
     </div>
     {settingsExtra}
    </div>}
   </div>
   <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`}><span aria-hidden="true">{theme==="dark"?"☀":"☾"}</span><b>{theme==="dark"?"Light":"Dark"}</b></button>
  </div>
 </nav>;
}
