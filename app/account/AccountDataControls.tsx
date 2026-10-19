"use client";
import {useState} from 'react';
import AuctionDialog from '../games/AuctionDialog';
import {authAction,useAccount} from './AccountProvider';
import {cloudStatus,flushCloud} from './storage';

export default function AccountDataControls(){
 const {user}=useAccount(),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const exportData=async()=>{
  setBusy(true);setError('');try{
   await flushCloud();if(cloudStatus().pending)throw new Error('Resolve unsynced changes before exporting your saved account.');
   const response=await fetch('/api/account/data',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Unable to export account data.');
   const {documents}=await response.json(),url=URL.createObjectURL(new Blob([JSON.stringify({type:'Raw Signal account export',exportedAt:new Date().toISOString(),profile:user,documents},null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='raw-signal-account.json';link.click();URL.revokeObjectURL(url);
  }catch(cause){setError(cause instanceof Error?cause.message:'Export failed.')}finally{setBusy(false)}
 };
 const remove=async()=>{setBusy(true);setError('');try{await authAction('delete-user',{});location.assign('/')}catch{setError('Account deletion failed. Log out and sign in again, then retry within ten minutes.')}finally{setBusy(false)}};
 return <><div className="account-social"><button className="game-control" type="button" disabled={busy} onClick={()=>void exportData()}>Export Account Data</button><button className="game-control account-delete" type="button" disabled={busy} onClick={()=>setConfirm(true)}>Delete Account</button></div>{error&&<p role="alert">{error}</p>}{confirm&&<AuctionDialog title="Delete Your Account?" onClose={()=>{if(!busy)setConfirm(false)}}><p>This permanently deletes your account, cloud game progress, favorites and saved imports. Guest saves and previously shared frozen links are not deleted. This also deletes your recovery key, so encrypted device drafts can no longer be unlocked. Export your data and any important drafts first if you want a copy.</p><p>You must have signed in within the last ten minutes.</p><button className="game-control account-delete" type="button" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Permanently Delete Account'}</button></AuctionDialog>}</>;
}
