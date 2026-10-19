"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useAccount} from './context';
import {authAction,AccountRequestError} from './auth-client';
import {useDeadline} from './useDeadline';
import InfoHint from '../InfoHint';
import ProviderIcon from './ProviderIcon';

export default function LoginForm({emailFirst=false,linkHint=false}:{emailFirst?:boolean;linkHint?:boolean}){
 const account=useAccount(),[email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[resendAt,setResendAt]=useState(0),[expiresAt,setExpiresAt]=useState(0);
 const cooldown=useDeadline(resendAt),expires=useDeadline(expiresAt);
 const [emailOpen,setEmailOpen]=useState(emailFirst);
 const emailInput=useRef<HTMLInputElement>(null),codeInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(sent)codeInput.current?.focus();else if(emailOpen)emailInput.current?.focus()},[sent,emailOpen]);
 const failed=(cause:unknown)=>{setError(cause instanceof Error?cause.message:'Sign-in could not be completed. Please try again.');if(cause instanceof AccountRequestError&&cause.status===429)setResendAt(Date.now()+cause.retryAfter*1000)};
 const send=async()=>{const address=email.trim().toLowerCase();await authAction('email-otp/send-verification-otp',{email:address,type:'sign-in'});setEmail(address);setSent(true);setCode('');setResendAt(Date.now()+30000);setExpiresAt(Date.now()+300000)};
 const submit=async(event:FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{if(sent){await authAction('sign-in/email-otp',{email,otp:code});location.assign(linkHint?'/account#sign-in-methods':'/account')}else await send()}catch(cause){failed(cause)}finally{setBusy(false)}};
 const resend=async()=>{if(cooldown||busy)return;setBusy(true);setError('');try{await send()}catch(cause){failed(cause)}finally{setBusy(false)}};
 const social=async(provider:'google'|'discord')=>{setBusy(true);setError('');try{const result=await authAction('sign-in/social',{provider,callbackURL:linkHint?'/account#sign-in-methods':'/account'});if(!result.url)throw new Error('This sign-in method is temporarily unavailable.');location.assign(result.url)}catch(cause){failed(cause);setBusy(false)}};
 return <section className="detail-section account-panel account-login-panel"><h2>Log In to Raw Signal <InfoHint label="About account sign-in">No passwords. Your email is private. Google and Discord provide identity only; we do not request access to your messages.</InfoHint></h2><p>Save your games, favorites, imports and preferences across devices.</p><p className="account-notice">Guest progress stays in this browser and will not transfer into your account.</p>{linkHint&&<p className="account-notice">After signing in, open Sign-In Methods to connect your other login. Your saved progress stays with this account.</p>}
  <div className="account-social account-provider-buttons"><button className="game-control" type="button" disabled={busy||!account.providers.discord} onClick={()=>void social('discord')}><ProviderIcon provider="discord"/>Log In with Discord</button><button className="game-control account-primary" type="button" disabled={busy||!account.providers.google} onClick={()=>void social('google')}><ProviderIcon provider="google"/>Log In with Google</button><button className="game-control" type="button" disabled={busy||!account.providers.email} aria-expanded={emailOpen} aria-controls="account-email-form" onClick={()=>setEmailOpen(value=>!value)}><ProviderIcon provider="email"/>Log In with an Email Account</button></div>
  {(!account.providers.google||!account.providers.discord)&&<p className="games-note">Some sign-in methods are not available in this environment yet.</p>}
  {emailOpen&&<form id="account-email-form" onSubmit={event=>void submit(event)} aria-label="Email sign-in"><label htmlFor="account-email">Email<input ref={emailInput} id="account-email" type="email" autoComplete="email" required maxLength={254} disabled={sent||busy} value={email} onChange={event=>setEmail(event.target.value)} aria-describedby="account-email-help"/></label>
   <span id="account-email-help" className="games-note">New here? Your account is created after you verify your email or provider.</span>
   {sent&&<label htmlFor="account-code">Sign-In Code<input ref={codeInput} id="account-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} onPaste={event=>{event.preventDefault();setCode(event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6))}} aria-describedby="account-code-help"/></label>}
   <button className="game-control account-primary" disabled={busy||!account.providers.email||(!sent&&cooldown>0)} type="submit">{busy?'Please Wait…':sent?'Verify Code':cooldown?`Email Me a Code (${cooldown}s)`:'Email Me a Code'}</button>
   {sent&&<><p id="account-code-help" className="games-note">{expires?`Use the newest email. Code expires in ${Math.floor(expires/60)}:${String(expires%60).padStart(2,'0')}.`:'This code has expired. Request a new code.'}</p><div className="account-social account-code-actions"><button className="game-control" type="button" disabled={busy||cooldown>0} onClick={()=>void resend()}>{cooldown?`Resend Code (${cooldown}s)`:'Resend Code'}</button><button className="game-control" type="button" disabled={busy} onClick={()=>{setSent(false);setCode('');setExpiresAt(0);setError('')}}>Change Email</button></div><p role="status" className="games-note">A code was requested for {email}. Check your inbox and spam folder.</p></>}
  </form>}{error&&<p role="alert" className="account-form-error">{error}</p>}
 </section>;
}
