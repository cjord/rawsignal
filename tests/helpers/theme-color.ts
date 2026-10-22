import type {Locator} from '@playwright/test';

export function themeColor(locator:Locator,token:string){
 return locator.evaluate((node,token)=>{
  const probe=document.createElement('span');probe.style.color=`var(${token})`;node.append(probe);
  const color=getComputedStyle(probe).color;probe.remove();return color;
 },token);
}
