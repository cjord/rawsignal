"use client";
import {useEffect,useRef,useState} from 'react';
import AuctionDialog from '../games/AuctionDialog';
import {authAction,useAccount} from './AccountProvider';
import {cloudStatus,flushCloud} from './storage';
import {requestJson} from '../data/request-json';

export default function AccountDataControls(){
 const {user,features}=useAccount(),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const exportData=async()=>{
  setBusy(true);setError('');try{
   await flushCloud();if(!mounted.current)return;if(cloudStatus().pending)throw new Error('Resolve unsynced changes before exporting your saved account.');
   const {response,data}=await requestJson('/api/account/export',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Unable to export account data.');
   if(!mounted.current)return;
   if(!data||typeof data!=='object'||!('profile' in data)||(data.profile as {id?:string})?.id!==user?.id)throw new Error('The signed-in account changed. Please reload before exporting.');
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='raw-signal-account.json';link.click();URL.revokeObjectURL(url);
  }catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'Export failed.')}finally{if(mounted.current)setBusy(false)}
 };
 const remove=async()=>{setBusy(true);setError('');try{await authAction('delete-user',{});location.assign('/')}catch{setError('Account deletion failed. Log out and sign in again, then retry within ten minutes.')}finally{setBusy(false)}};
 return <><div className="account-social"><button className="game-control" type="button" disabled={busy} onClick={()=>void exportData()}>Export Account Data</button>{features?.identityReadOnly?<a className="game-control" href="https://rawsignal.cards/account">Manage Account on Production</a>:<button className="game-control account-delete" type="button" disabled={busy} onClick={()=>setConfirm(true)}>Delete Account</button>}</div>{error&&<p role="alert">{error}</p>}{confirm&&<AuctionDialog title="Delete Your Account?" onClose={()=>{if(!busy)setConfirm(false)}}><p>This permanently deletes your shared sign-in identity and this environment’s cloud game progress, favorites and saved imports. Staging test data is removed on its next account-service cleanup; no staging sign-in remains possible. Guest saves and previously shared frozen links are not deleted. This also deletes your recovery key, so encrypted device drafts can no longer be unlocked. Export your data from each environment and any important drafts first if you want a copy.</p><p>You must have signed in within the last ten minutes.</p><button className="game-control account-delete" type="button" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Permanently Delete Account'}</button></AuctionDialog>}</>;
}
