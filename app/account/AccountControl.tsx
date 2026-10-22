"use client";
import {useState} from 'react';
import {signOutAccount,useAccount} from './AccountProvider';
export default function AccountControl(){
 const account=useAccount(),[busy,setBusy]=useState(false),[error,setError]=useState('');if(!account.enabled)return null;
 return <><button className={`theme-toggle account-login${!account.loading&&!account.user?' account-primary':''}`} type="button" aria-busy={account.loading||busy} aria-label={account.loading?'Checking account':undefined} disabled={busy||account.loading} onClick={()=>{if(!account.user){location.assign('/account');return}setBusy(true);void signOutAccount().catch(cause=>{setError(cause.message);setBusy(false)})}}>{account.loading?<span className="account-control-placeholder" aria-hidden="true"/>:busy?'Logging Out…':account.user?'Log Out':'Log In'}</button>{error&&<span role="alert" className="account-control-error">{error}</span>}</>;
}
