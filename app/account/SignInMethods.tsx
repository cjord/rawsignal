"use client";
import {useEffect,useState} from 'react';
import {useAccount} from './context';
import {accountRequest,authAction} from './auth-client';
import {cloudStatus,flushCloud} from './storage';

export default function SignInMethods(){
 const {providers,features}=useAccount(),[linked,setLinked]=useState<string[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let current=true;
  void accountRequest('list-accounts').then(data=>{
   if(!Array.isArray(data))throw new Error('Unable to load connected sign-in methods.');
   if(current){setLinked(data.map(row=>row.providerId));setError('')}
  }).catch(()=>{if(current)setError('Unable to load connected sign-in methods. Please retry.')});
  return()=>{current=false};
 },[attempt]);
 const link=async(provider:'google'|'discord')=>{
  setBusy(true);setError('');try{
   await flushCloud();if(cloudStatus().pending)throw new Error('Wait for cloud saves to finish before connecting a sign-in method.');
   const result=await authAction('link-social',{provider,callbackURL:'/account#sign-in-methods'});
   if(!result.url)throw new Error('This sign-in method is temporarily unavailable.');location.assign(result.url);
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to connect this sign-in method.');setBusy(false)}
 };
 return <section id="sign-in-methods" className="account-section" aria-labelledby="account-methods-title"><h2 id="account-methods-title">Sign-In Methods</h2><p className="games-note">Connect another method while signed in to keep one account and the same saved progress. Matching email addresses alone do not link accounts.</p>
  {linked===null&&!error&&<p role="status">Loading Sign-In Methods…</p>}
  {features?.identityReadOnly&&<p className="games-note">Sign-in methods are shared. <a href="https://rawsignal.cards/account#sign-in-methods">Manage them on production</a>; staging cannot change them.</p>}
  <div className="account-methods">{(['google','discord'] as const).map(provider=><div className="account-method" key={provider}><span>{provider==='google'?'Google':'Discord'}</span>{linked?.includes(provider)?<span className="account-badge">Connected</span>:features?.identityReadOnly?<span className="games-note">Not Connected</span>:<button className="game-control" type="button" disabled={busy||linked===null||!providers[provider]} onClick={()=>void link(provider)}>Link {provider==='google'?'Google':'Discord'}</button>}</div>)}
   <div className="account-method"><span>Email Code<small>Uses your account email</small></span><span className={providers.email?'account-badge':'games-note'}>{providers.email?'Available':'Unavailable'}</span></div>
  </div>{error&&<p role="alert" className="account-form-error">{error} {linked===null&&<button className="game-control" type="button" onClick={()=>{setError('');setAttempt(value=>value+1)}}>Retry Sign-In Methods</button>}</p>}
 </section>;
}
