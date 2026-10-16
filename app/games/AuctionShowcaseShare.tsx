"use client";
import {useState} from 'react';
import AuctionDialog from './AuctionDialog';
import {auctionProfilePath,type AuctionProfileShare} from '../../core/domain/auction-profile-share';

export default function AuctionShowcaseShare({snapshot,close}:{snapshot:AuctionProfileShare;close:()=>void}){
 const [message,setMessage]=useState('');let path='';
 try{path=auctionProfilePath(snapshot)}catch{return <AuctionDialog title="Share Your Showcase" onClose={close}><p role="alert">This snapshot is too large to share. Try fewer cards or a shorter display name.</p></AuctionDialog>}
 const url=typeof window==='undefined'?'':window.location.origin+path;
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setMessage('Showcase link copied.')}catch{setMessage('Select and copy the link below.')}};
 return <AuctionDialog title="Share Your Showcase" onClose={close} dismissOnOutside><p>This link contains a frozen snapshot of your name, auction statistics and showcased cards. It does not include cash or the rest of your inventory. Anyone with the link can view it; it will not update when you edit your showcase. Already-shared snapshots cannot be revoked.</p><p className="games-note">Self-reported virtual ownership, not a verified profile. Links can be long; some chat apps may not preview them.</p><label className="game-share-preview">Showcase Link<textarea readOnly rows={4} value={url} onFocus={event=>event.target.select()}/></label><div className="auction-actions"><button className="game-control" type="button" onClick={()=>void copy()}>Copy Showcase Link</button><a className="game-control" href={path} target="_blank" rel="noopener noreferrer">Preview Shared Showcase</a></div><p role="status">{message}</p></AuctionDialog>;
}
