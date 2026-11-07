import type {Token} from 'marked';
import {isArticleProductToken} from './article-product-links.ts';

function headingLabel(tokens:Token[],depth=0):string{
 if(depth>24)return '';
 return tokens.map(token=>{
  if(isArticleProductToken(token))return token.text;
  if('tokens' in token&&Array.isArray(token.tokens))return headingLabel(token.tokens,depth+1);
  return 'text' in token&&typeof token.text==='string'?token.text:'';
 }).join('').replace(/&(amp|lt|gt|quot|#39);/g,(_,key:string)=>({'amp':'&','lt':'<','gt':'>','quot':'"','#39':"'"}[key]??'')).replace(/\s+/g,' ').trim();
}
export function articleOutline(tokens:Token[],prefix:string){
 const headings=new Map<Token,{id:string;label:string}>();
 const walk=(items:Token[],depth=0)=>{
  if(depth>24)return;
  for(const token of items){
   if(token.type==='heading'){const label=headingLabel(token.tokens??[]);if(label)headings.set(token,{id:`${prefix}-section-${headings.size+1}`,label})}
   if('tokens' in token&&Array.isArray(token.tokens))walk(token.tokens,depth+1);
   if(token.type==='list')for(const item of token.items)walk(item.tokens,depth+1);
  }
 };walk(tokens);
 return headings;
}
