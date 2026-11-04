"use client";
import {useEffect,useMemo,useState} from 'react';
import {articleLookupTargets,articleProductKey,inspectArticleMarkdown,type ArticleProduct,type ArticleReference} from '../../../core/domain/articles';
import {requestJson} from '../../data/request-json';

export default function useArticleProductLookup(markdown:string,saved:ArticleReference[]=[]){
 const inspected=useMemo(()=>inspectArticleMarkdown(markdown),[markdown]);
 const lookup=articleLookupTargets(inspected,saved),params=new URLSearchParams();
 if(lookup.products.length)params.set('ids',lookup.products.map(articleProductKey).join(','));
 for(const name of lookup.names)params.append('name',name);
 const key=params.toString(),tooMany=lookup.products.length+lookup.names.length>40;
 const [result,setResult]=useState<{key:string;products:ArticleProduct[];error:string}>({key:'',products:[],error:''});
 useEffect(()=>{
  if(!key||tooMany)return;
  const controller=new AbortController(),timer=setTimeout(()=>{
   void requestJson(`/api/articles/products?${key}`,{signal:controller.signal}).then(({response,data})=>{
    if(!response.ok)throw new Error('Product lookup is unavailable. Your draft is preserved; retry before publication.');
    if(!controller.signal.aborted)setResult({key,products:(data as {products:ArticleProduct[]}).products,error:''});
   }).catch(()=>{if(!controller.signal.aborted)setResult({key,products:[],error:'Product lookup is unavailable. Your draft is preserved; edit a reference or reload to retry.'})});
  },300);
  return()=>{clearTimeout(timer);controller.abort()};
 },[key,tooMany]);
 const products=result.key===key&&!tooMany?result.products:[];
 // Preserve the saved name used by [[name]] even if the live catalog later renames it.
 const references=products.map(p=>saved.find(r=>articleProductKey(r)===articleProductKey(p))??p);
 return {products,references,error:result.key===key?result.error:''};
}
