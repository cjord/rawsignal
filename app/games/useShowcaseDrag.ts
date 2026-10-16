"use client";
import {useEffect,useRef} from 'react';

// Carry a complete, opaque tile instead of the OS's translucent image ghost.
export function useShowcaseDrag(){
 const preview=useRef<HTMLElement|null>(null),offset=useRef({x:0,y:0});
 const clear=()=>{preview.current?.remove();preview.current=null};
 useEffect(()=>{const track=(event:DragEvent)=>{const node=preview.current;if(node){node.style.left=`${event.clientX-offset.current.x}px`;node.style.top=`${event.clientY-offset.current.y}px`}};document.addEventListener('dragover',track);document.addEventListener('dragend',clear);document.addEventListener('drop',clear);return()=>{clear();document.removeEventListener('dragover',track);document.removeEventListener('dragend',clear);document.removeEventListener('drop',clear)}},[]);
 return (event:React.DragEvent<HTMLElement>)=>{
  clear();const rect=event.currentTarget.getBoundingClientRect(),node=event.currentTarget.cloneNode(true) as HTMLElement;
  offset.current={x:event.clientX-rect.left,y:event.clientY-rect.top};node.classList.add('auction-drag-preview');node.setAttribute('aria-hidden','true');node.inert=true;node.style.width=`${rect.width}px`;node.style.left=`${rect.left}px`;node.style.top=`${rect.top}px`;document.body.append(node);preview.current=node;
  const blank=document.createElement('canvas');blank.width=1;blank.height=1;event.dataTransfer.setDragImage(blank,0,0);event.dataTransfer.effectAllowed='move';
 };
}
