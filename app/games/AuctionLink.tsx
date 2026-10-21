"use client";
import Link from 'next/link';
import type {AnchorHTMLAttributes,MouseEvent} from 'react';
import {useAuctionShell} from './auction-shell-context';
type Props=AnchorHTMLAttributes<HTMLAnchorElement>&{href:string};
function plainClick(event:MouseEvent<HTMLAnchorElement>){return event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey}
export default function AuctionLink({onClick,href,children,...props}:Props){
 const shell=useAuctionShell();
 if(!shell.active||!href.startsWith('/games/riftbound-auction'))return <a {...props} href={href} onClick={onClick}>{children}</a>;
 return <Link {...props} href={href} prefetch={false} onClick={event=>{
  onClick?.(event);if(event.defaultPrevented||!plainClick(event))return;
  if(!shell.allowNavigation()){event.preventDefault();return}
  const target=new URL(href,location.origin);
  if(target.pathname===location.pathname&&target.search===location.search&&target.hash!==location.hash){event.preventDefault();history.pushState(null,'',target);window.dispatchEvent(new HashChangeEvent('hashchange'))}
 }}>{children}</Link>;
}
