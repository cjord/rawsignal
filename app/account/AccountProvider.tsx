"use client";
/* eslint-disable react-hooks/set-state-in-effect -- account/session and save status hydrate from the server after mount. */
import {useEffect,useState,useCallback,type ReactNode} from 'react';
import {cloudStatus,configureAccountStorage,flushCloud,getSavedItem,pendingBackup,retryCloud,subscribeCloud} from './storage';
import type {AccountDocument} from '../../core/domain/account-data';

import {AccountContext,accountDefaults as defaults,type AccountState} from './context';
export {useAccount,type AccountUser} from './context';
export async function authAction(path:string,body:unknown){
 const response=await fetch(`/api/auth/${path}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.message??'Account request failed. Please try again.');return data;
}
export async function signOutAccount(){await flushCloud();if(cloudStatus().pending)throw new Error('Wait for cloud saves to finish before logging out.');await authAction('sign-out',{});location.assign('/');}
function downloadBackup(){const url=URL.createObjectURL(new Blob([pendingBackup()],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='raw-signal-unsynced-backup.json';link.click();URL.revokeObjectURL(url);}
export default function AccountProvider({enabled,children}:{enabled:boolean;children:ReactNode}){
 const [account,setAccount]=useState<AccountState>({...defaults,enabled,loading:enabled}),[scope,setScope]=useState('initial'),[cloud,setCloud]=useState(cloudStatus);
 const bootstrap=useCallback(async()=>{
  if(cloudStatus().pending){setAccount(current=>({...current,error:'Unsynced changes are still in this tab. Export them before reloading or changing accounts.'}));return}
  configureAccountStorage('loading');setAccount(current=>({...current,loading:true,error:''}));
  try{
   const response=await fetch('/api/account/session',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Account service unavailable. Retry before making changes.');
   const data=await response.json() as AccountState&{documents:AccountDocument[]};
   configureAccountStorage(data.user?'account':'guest',data.user?.id,data.documents??[]);
   if(data.user){document.documentElement.dataset.theme=getSavedItem('raw-signal-theme')==='light'?'light':'dark';document.documentElement.dataset.fontSize=getSavedItem('raw-signal-font-size')==='large'?'large':'default';}
   setScope(data.user?.id??'guest');setAccount({...data,loading:false,error:''});
   try{localStorage.setItem('raw-signal-account-identity',data.user?.id??'guest')}catch{/* The cookie still identifies this tab securely. */}
  }catch{configureAccountStorage('blocked');setAccount(current=>({...current,loading:false,error:'Account service unavailable. Your saved data has not been overwritten.'}));}
 },[]);
 useEffect(()=>{if(enabled)void bootstrap();return()=>{if(enabled)configureAccountStorage('loading')}},[enabled,bootstrap]);
 useEffect(()=>subscribeCloud(()=>setCloud(cloudStatus())),[]);
 useEffect(()=>{if(!enabled)return;const changed=(event:StorageEvent)=>{if(event.key==='raw-signal-account-identity'){if(cloudStatus().pending){setAccount(current=>({...current,error:'The account changed in another tab. Export pending changes before reloading.'}));return}location.reload()}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed)},[enabled]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(cloudStatus().pending){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[]);
 if(!enabled)return children;
 return <AccountContext.Provider value={account}>
  {account.error&&<div className="account-status" role="alert">{account.error} {cloud.pending?<button type="button" className="game-control" onClick={downloadBackup}>Export Pending Changes</button>:<button type="button" className="game-control" onClick={()=>void bootstrap()}>Retry Account</button>}</div>}
  {account.user&&<div className="account-status" role={cloud.error?'alert':'status'}>{cloud.error|| (cloud.pending?'Saving to your account…':'Account saves up to date')}{cloud.error&&<><button className="game-control" type="button" onClick={retryCloud}>Retry Save</button><button className="game-control" type="button" onClick={downloadBackup}>Export Pending Changes</button></>}</div>}
  <div key={scope} inert={account.loading||!!account.error||!!cloud.error}>{children}</div>
 </AccountContext.Provider>;
}
