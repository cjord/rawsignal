"use client";
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {dismissNotification,notificationSnapshot,notificationServerSnapshot,subscribeNotifications,type SiteNotification} from './store';
function Notice({item}:{item:SiteNotification}){
 const [paused,setPaused]=useState(()=>document.hidden),remaining=useRef(item.duration),started=useRef(0),element=useRef<HTMLElement>(null),hovered=useRef(false);
 const resume=useCallback(()=>setPaused(document.hidden||hovered.current||!!element.current?.contains(document.activeElement)),[]);
 useEffect(()=>{
  if(!item.duration||paused||document.hidden)return;
  started.current=Date.now();const timer=window.setTimeout(()=>dismissNotification(item.id),remaining.current);
  return()=>{clearTimeout(timer);remaining.current=Math.max(0,remaining.current-(Date.now()-started.current))};
 },[item.id,item.duration,paused]);
 useEffect(()=>{
  // The message is click-through, so measure hover without intercepting controls
  // underneath it. Only the explicit dismiss button takes pointer input.
  const moved=(event:PointerEvent)=>{const box=element.current?.getBoundingClientRect();hovered.current=event.pointerType==='mouse'&&!!box&&event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;resume()};
  const left=()=>{hovered.current=false;resume()};
  window.addEventListener('pointermove',moved,{passive:true});document.addEventListener('visibilitychange',resume);document.addEventListener('mouseleave',left);
  return()=>{window.removeEventListener('pointermove',moved);document.removeEventListener('visibilitychange',resume);document.removeEventListener('mouseleave',left)};
 },[resume]);
 return <section ref={element} className="site-notification" data-tone={item.tone} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>queueMicrotask(resume)} aria-label="Notification"><p>{item.message}</p><button type="button" onClick={()=>dismissNotification(item.id)} aria-label="Dismiss Notification">×</button></section>;
}
export default function NotificationHost(){
 const notices=useSyncExternalStore(subscribeNotifications,notificationSnapshot,notificationServerSnapshot);
 return <div className="site-notifications" role="log" aria-live="polite" aria-relevant="additions" aria-label="Site Notifications">{notices.map(item=><Notice key={`${item.id}:${item.createdAt}`} item={item}/>)}</div>;
}
