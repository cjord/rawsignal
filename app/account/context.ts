"use client";
import {createContext,useContext} from 'react';
export type AccountUser={id:string;name:string;email:string;emailVerified:boolean;image?:string|null};
export type AccountState={enabled:boolean;loading:boolean;user:AccountUser|null;providers:{google:boolean;discord:boolean;email:boolean};error:string};
export const accountDefaults:AccountState={enabled:false,loading:false,user:null,providers:{google:false,discord:false,email:false},error:''};
export const AccountContext=createContext(accountDefaults);
export const useAccount=()=>useContext(AccountContext);
