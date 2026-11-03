"use client";
import {useCallback,useEffect,useState} from 'react';
import {emptyArticleDraft,type ArticleAction,type ArticleDraft,type ArticleRecord} from '../../../core/domain/articles';
import {requestJson} from '../../data/request-json';

export type RevisionPage={rows:{revision:number;createdAt:string}[];nextBefore:number|null};
async function requestArticle(url:string,body?:unknown){
 const {response,data}=await requestJson(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const result=data as {error?:string;article:ArticleRecord;history:RevisionPage};if(!response.ok)throw new Error(result?.error??'Article request failed. Keep your unsaved text.');return result;
}
export default function useArticleEditor(id?:string){
 const [record,setRecord]=useState<ArticleRecord|null>(null),[draft,setDraft]=useState<ArticleDraft>(emptyArticleDraft),[history,setHistory]=useState<RevisionPage>({rows:[],nextBefore:null});
 const [error,setError]=useState(''),[busy,setBusy]=useState(!!id),[message,setMessage]=useState(''),[reviewed,setReviewed]=useState(false);
 const dirty=record?JSON.stringify(draft)!==JSON.stringify(record.draft):JSON.stringify(draft)!==JSON.stringify(emptyArticleDraft());
 const change=useCallback((next:ArticleDraft)=>{setDraft(next);setReviewed(false);setMessage('')},[]);
 const load=useCallback(async()=>{
  const key=id??record?.id;if(!key)return;setBusy(true);setError('');
  try{const result=await requestArticle(`/api/account/admin/articles/${key}`);setRecord(result.article);setDraft(result.article.draft);setHistory(result.history);setReviewed(false)}catch(cause){setError((cause as Error).message)}finally{setBusy(false)};
 },[id,record?.id]);
 useEffect(()=>{if(!id)return;let current=true;void requestArticle(`/api/account/admin/articles/${id}`).then(result=>{if(current){setRecord(result.article);setDraft(result.article.draft);setHistory(result.history)}}).catch(cause=>{if(current)setError(cause.message)}).finally(()=>{if(current)setBusy(false)});return()=>{current=false}},[id]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 async function save(){setBusy(true);setError('');setMessage('');
  try{const result=await requestArticle(`/api/account/admin/articles${record?`/${record.id}`:''}`,{revision:record?.revision??0,draft});setRecord(result.article);setDraft(result.article.draft);setReviewed(false);setMessage(`Saved revision ${result.article.revision}.`);if(!id)window.history.replaceState(null,'',`/admin/articles/${result.article.id}`);const current=await requestArticle(`/api/account/admin/articles/${result.article.id}`);setHistory(current.history)}catch(cause){setError((cause as Error).message)}finally{setBusy(false)}
 }
 async function action(action:ArticleAction,note:string){if(!record||dirty)return;
  setBusy(true);setError('');setMessage('');
  try{const result=await requestArticle(`/api/account/admin/articles/${record.id}`,{action,revision:record.revision,note,reviewed});setRecord(result.article);setDraft(result.article.draft);setReviewed(false);setMessage(`${action==='publish'?'Published':action==='unpublish'?'Unpublished':'Updated'} revision ${result.article.revision}.`)}catch(cause){setError((cause as Error).message)}finally{setBusy(false)}
 }
 async function historyPage(before?:number){if(!record)return;try{const result=await requestArticle(`/api/account/admin/articles/${record.id}${before?`?before=${before}`:''}`);setHistory(result.history)}catch(cause){setError((cause as Error).message)}}
 async function compare(revision:number):Promise<ArticleRecord|null>{if(!record)return null;try{return (await requestArticle(`/api/account/admin/articles/${record.id}?revision=${revision}`)).article}catch(cause){setError((cause as Error).message);return null}}
 return {record,draft,history,error,busy,message,reviewed,dirty,change,save,action,load,historyPage,compare,setReviewed,setError};
}
