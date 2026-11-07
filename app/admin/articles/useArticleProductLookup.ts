"use client";
import {useEffect,useMemo,useState} from 'react';
import {articleProductKey,articleReferenceSnapshots,inspectArticleMarkdown,type ArticleProduct,type ArticleReference} from '../../../core/domain/articles';
import {articleBoundLookup,type ArticleBinding} from '../../../core/domain/article-authoring';
import {requestJson} from '../../data/request-json';

function lookupProducts(value:unknown):ArticleProduct[]{
 const products=(value as {products?:unknown})?.products;
 if(!Array.isArray(products)||!products.every(p=>p&&['single','sealed'].includes(p.kind)&&Number.isSafeInteger(p.productId)&&p.productId>0&&['name','set','game','number','printing'].every(k=>typeof p[k]==='string')&&[p.marketPrice,p.midPrice].every(n=>n===null||typeof n==='number'&&Number.isFinite(n))&&validAliases(p.aliases)))throw new Error('Invalid product lookup response.');
 return products;
}
const validAliases=(value:unknown)=>value===undefined||Array.isArray(value)&&value.length<=40&&value.every(a=>typeof a==='string'&&a.length<=300);
export default function useArticleProductLookup(markdown:string,saved:ArticleReference[]=[],savedMarkdown='',bindings:ArticleBinding[]=[]){
 const inspected=useMemo(()=>inspectArticleMarkdown(markdown),[markdown]);
 const lookup=articleBoundLookup(inspected,saved,savedMarkdown,bindings),params=new URLSearchParams();
 if(lookup.products.length)params.set('ids',lookup.products.map(articleProductKey).join(','));
 for(const name of lookup.names)params.append('name',name);
 const key=params.toString(),tooMany=lookup.products.length+lookup.names.length>40;
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<{key:string;attempt:number;products:ArticleProduct[];error:string}>({key:'',attempt:0,products:[],error:''});
 useEffect(()=>{
  if(!key||tooMany)return;
  const controller=new AbortController(),timer=setTimeout(()=>{
   void requestJson(`/api/articles/products?${key}`,{signal:controller.signal}).then(({response,data})=>{
    if(!response.ok)throw new Error('Product lookup unavailable.');
    const products=lookupProducts(data);
    if(!controller.signal.aborted)setResult({key,attempt,products,error:''});
   }).catch(()=>{if(!controller.signal.aborted)setResult({key,attempt,products:[],error:'Product lookup is unavailable. Your draft is preserved. Retry to check the links again.'})});
  },300);
  return()=>{clearTimeout(timer);controller.abort()};
 },[key,tooMany,attempt]);
 const ready=result.key===key&&result.attempt===attempt,loading=!!key&&!tooMany&&!ready;
 const products=ready&&!tooMany?result.products:[],references=articleReferenceSnapshots(products,saved,inspected.names,lookup.products);
 return {products,references,loading,error:ready?result.error:'',retry:()=>setAttempt(n=>n+1)};
}
