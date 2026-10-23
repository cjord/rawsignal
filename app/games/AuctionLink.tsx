"use client";
import type {AnchorHTMLAttributes,MouseEvent} from 'react';
import {useAuctionShell} from './auction-shell-context';
type Props=AnchorHTMLAttributes<HTMLAnchorElement>&{href:string};
function plainClick(event:MouseEvent<HTMLAnchorElement>){return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey}
export default function AuctionLink({onClick,href,children,...props}:Props){
 const shell=useAuctionShell();
 if(!shell.active||!href.startsWith('/games/riftbound-auction'))return <a {...props} href={href} onClick={onClick}>{children}</a>;
 // The installed vinext Link shim loses its dynamic navigation export in production.
 // The public router uses the same RSC navigation without that dynamic-import path.
 return <a {...props} href={href} onClick={event=>{
  onClick?.(event);if(event.defaultPrevented||!plainClick(event)||event.currentTarget.target&&event.currentTarget.target!=='_self'||event.currentTarget.hasAttribute('download'))return;
  if(!shell.allowNavigation()){event.preventDefault();return}
  const target=new URL(href,location.origin);
  event.preventDefault();
  if(target.pathname===location.pathname&&target.search===location.search&&target.hash!==location.hash){history.pushState(null,'',target);window.dispatchEvent(new HashChangeEvent('hashchange'));return}
  shell.navigate(target.pathname+target.search+target.hash);
 }}>{children}</a>;
}
