"use client";
import {createContext,useContext} from 'react';
export type AccountUser={id:string;name:string;email:string;emailVerified:boolean;publicUsername?:string|null;image?:string|null;role?:'member'|'admin'};
export type AccountState={enabled:boolean;loading:boolean;user:AccountUser|null;providers:{google:boolean;discord:boolean;email:boolean};error:string;restricted?:boolean;features?:{recovery:boolean;audit:boolean;community?:boolean;sharedIdentity?:boolean;identityReadOnly?:boolean;collections?:boolean}};
export const accountDefaults:AccountState={enabled:false,loading:false,user:null,providers:{google:false,discord:false,email:false},error:''};
export const AccountContext=createContext<AccountState&{updateName:(name:string,publicUsername?:string)=>void}>({...accountDefaults,updateName:()=>{}});
export const useAccount=()=>useContext(AccountContext);
