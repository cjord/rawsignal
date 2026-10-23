import {useEffect,type RefObject} from 'react';
import {backdropResizeTime} from '../../core/domain/auction-backdrop';

export function useBackdropPhase(root:RefObject<HTMLDivElement|null>){
 useEffect(()=>{
  const widths=new Map<Element,number>();
  const observer=new ResizeObserver(entries=>{
   for(const entry of entries){
    const group=entry.target,width=group.getBoundingClientRect().width,previous=widths.get(group);widths.set(group,width);
    const animation=group.parentElement?.getAnimations()[0];
    if(!animation||previous===undefined||previous===width||typeof animation.currentTime!=='number')continue;
    const timing=animation.effect?.getTiming(),duration=Number(timing?.duration);
    animation.currentTime=backdropResizeTime(animation.currentTime,duration,previous,width,timing?.direction==='reverse');
   }
  });
  root.current?.querySelectorAll('.auction-entry-art-group:first-child').forEach(group=>observer.observe(group));
  return()=>observer.disconnect();
 },[root]);
}
