"use client";
import {useState} from 'react';
import {signOutAccount,useAccount} from './AccountProvider';
export default function AccountControl(){
 const account=useAccount(),[busy,setBusy]=useState(false),[error,setError]=useState('');if(!account.enabled)return null;
 return <><button className="theme-toggle account-login" type="button" disabled={busy||account.loading} onClick={()=>{if(!account.user){location.assign('/account');return}setBusy(true);void signOutAccount().catch(cause=>{setError(cause.message);setBusy(false)})}}>{busy?'Logging Out…':account.loading?'Account…':account.user?'Log Out':'Log In'}</button>{error&&<span role="alert" className="account-control-error">{error}</span>}</>;
}
