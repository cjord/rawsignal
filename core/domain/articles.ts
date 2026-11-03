import {marked,type Token} from 'marked';
import type {RowMetrics} from './types.ts';

export const ARTICLE_STATES=['draft','needs-review','approved','published','rejected','archived'] as const;
export type ArticleState=typeof ARTICLE_STATES[number];
export const ARTICLE_CATEGORIES=['release-outlook','weekly-recap','monthly-review','analysis'] as const;
export type ArticleProduct={kind:'single'|'sealed';productId:number;name:string;set:string;game:string;number:string;printing:string;image:string|null;marketPrice:number|null;midPrice:number|null;metrics?:RowMetrics};
export type ArticleReference=Pick<ArticleProduct,'kind'|'productId'|'name'|'set'|'game'|'number'|'printing'|'image'>;
export type ArticleForecast={productKey:string;low:number;high:number;basis:'delivered'|'item'|'market';confidence:'low'|'medium';rationale:string;invalidation:string};
export type ArticleDraft={title:string;slug:string;summary:string;game:'riftbound'|'pokemon'|'mixed';setName:string;category:typeof ARTICLE_CATEGORIES[number];byline:string;markdown:string;observedAt:string;targetDate:string;aiAssisted:boolean;disclosure:string;sources:string[];evidenceNotes:string;forecasts:ArticleForecast[]};
export type ArticleRecord={id:string;revision:number;state:ArticleState;publishedRevision:number|null;publishedAt:string|null;createdAt:string;updatedAt:string;draft:ArticleDraft;references:ArticleReference[]};
export type ArticleSummary=Pick<ArticleRecord,'id'|'revision'|'state'|'publishedRevision'|'publishedAt'|'updatedAt'>&Pick<ArticleDraft,'title'|'slug'|'summary'|'game'|'category'|'setName'|'byline'>;
export type ArticleRelease={revision:number;publishedAt:string;note:string};
export type PublicArticle=Omit<ArticleDraft,'evidenceNotes'>&{revision:number;publishedAt:string;firstPublishedAt:string;references:ArticleReference[];releases:ArticleRelease[]};
export const emptyArticleDraft=():ArticleDraft=>({title:'',slug:'',summary:'',game:'riftbound',setName:'',category:'analysis',byline:'Raw Signal Editorial',markdown:'',observedAt:'',targetDate:'',aiAssisted:true,disclosure:'',sources:[],evidenceNotes:'',forecasts:[]});
export const articleProductKey=(p:Pick<ArticleReference,'kind'|'productId'>)=>`${p.kind}:${p.productId}`;
export const articleProductHref=(p:Pick<ArticleReference,'kind'|'productId'|'game'>)=>p.kind==='single'?`/cards/${p.productId}`:`/sealed/${p.productId}?market=${encodeURIComponent(p.game)}`;
export function articleListOptions(query:URLSearchParams){
 const page=Number(query.get('page')??1),game=query.get('game')??'',category=query.get('category')??'',q=query.get('q')??'';
 if(!Number.isSafeInteger(page)||page<1||page>1000||game&&!['riftbound','pokemon','mixed'].includes(game)||category&&!(ARTICLE_CATEGORIES as readonly string[]).includes(category)||q.length>100)throw new RangeError('Invalid article filters.');
 return {page,game,category,query:q};
}

export function articleHref(value:string):string|null{
 if(!value||value.length>2048||[...value].some(c=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127||c==='\\'))return null;
 if(/^#[a-z\d_-]+$/i.test(value))return value;
 try{const u=new URL(value,'https://rawsignal.cards');if(u.username||u.password||u.protocol!=='https:')return null;
  return u.origin==='https://rawsignal.cards'?`${u.pathname}${u.search}${u.hash}`:u.href;
 }catch{return null}
}
export function articleLinkProduct(href:string):Pick<ArticleReference,'kind'|'productId'>|null{
 const safe=articleHref(href);if(!safe?.startsWith('/'))return null;
 const match=safe.match(/^\/(cards|sealed)\/(\d+)(?:[?#]|$)/);if(!match)return null;
 const productId=Number(match[2]);return Number.isSafeInteger(productId)&&productId>0&&productId<1e9?{kind:match[1]==='cards'?'single':'sealed',productId}:null;
}
export function articleTokens(markdown:string):Token[]{return marked.lexer(markdown.slice(0,60000),{gfm:true})}
export function inspectArticleMarkdown(markdown:string){
 const products=new Map<string,Pick<ArticleReference,'kind'|'productId'>>(),problems=new Set<string>();let count=0;
 const walk=(tokens:Token[],depth=0)=>{if(depth>24){problems.add('Markdown nesting is too deep.');return}
  for(const token of tokens){if(++count>12000){problems.add('Article formatting is too complex.');return}
   if(token.type==='html'||token.type==='image')problems.add('Raw HTML and external embedded images are not supported. Use product references.');
   if(token.type==='link'){if(!articleHref(token.href))problems.add('An article link is invalid or unsafe.');const p=articleLinkProduct(token.href);if(p)products.set(articleProductKey(p),p)}
   if('tokens' in token&&Array.isArray(token.tokens))walk(token.tokens,depth+1);
   if(token.type==='list')for(const item of token.items)walk(item.tokens,depth+1);
   if(token.type==='table')for(const cell of [...token.header,...token.rows.flat()])walk(cell.tokens,depth+1);
  }
 };walk(articleTokens(markdown));if(products.size>40)problems.add('An article can reference at most 40 distinct products.');
 return {products:[...products.values()],problems:[...problems]};
}
const boundedText=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max&&![...v].some(c=>{const n=c.charCodeAt(0);return n<32&&![9,10,13].includes(n)||n===127});
const dateOnly=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const observationTime=(v:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&dateOnly(v.slice(0,10))&&Number.isFinite(Date.parse(v));
function validForecast(value:unknown){
 if(!value||typeof value!=='object')return false;
 const f=value as ArticleForecast;
 return /^(single|sealed):[1-9]\d{0,8}$/.test(f.productKey)&&[f.low,f.high].every(n=>Number.isFinite(n)&&n>=0&&n<=1e8)&&f.low<=f.high&&['delivered','item','market'].includes(f.basis)&&['low','medium'].includes(f.confidence)&&boundedText(f.rationale,1000)&&boundedText(f.invalidation,1000);
}
export function parseArticleDraft(value:unknown):ArticleDraft{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid article draft.');
 const d=value as ArticleDraft,limits={title:180,slug:100,summary:500,setName:100,byline:80,markdown:60000,observedAt:30,targetDate:10,disclosure:1000,evidenceNotes:16000};
 for(const [key,max]of Object.entries(limits))if(!boundedText(d[key as keyof typeof limits],max))throw new Error(`Invalid ${key}.`);
 if(!['riftbound','pokemon','mixed'].includes(d.game)||!ARTICLE_CATEGORIES.includes(d.category)||typeof d.aiAssisted!=='boolean')throw new Error('Invalid article classification.');
 if(d.slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug))throw new Error('Use a lowercase slug with letters, numbers and hyphens.');
 if(d.slug==='products')throw new Error('That URL is reserved for product lookups. Choose another slug.');
 if(!Array.isArray(d.sources)||d.sources.length>30||d.sources.some(s=>typeof s!=='string'||s.trim()&&(!articleHref(s.trim())||!s.trim().startsWith('https://'))))throw new Error('Sources must be up to 30 HTTPS links.');
 if(!Array.isArray(d.forecasts)||d.forecasts.length>40)throw new Error('Too many forecasts.');
 if(!d.forecasts.every(validForecast))throw new Error('Invalid forecast.');
 const fields=Object.fromEntries([...Object.keys(limits),'game','category','aiAssisted'].map(k=>[k,d[k as keyof ArticleDraft]]));
 return {...fields,sources:d.sources.map(s=>s.trim()).filter(Boolean),forecasts:d.forecasts.map(({productKey,low,high,basis,confidence,rationale,invalidation})=>({productKey,low,high,basis,confidence,rationale,invalidation}))} as ArticleDraft;
}
export function articleReviewProblems(draft:ArticleDraft,references:ArticleReference[],now=Date.now()):string[]{
 const inspected=inspectArticleMarkdown(draft.markdown),problems=[...inspected.problems];
 if(!draft.title.trim()||!draft.slug||!draft.summary.trim()||!draft.byline.trim()||draft.markdown.trim().length<80)problems.push('Title, slug, summary, byline and article text are required.');
 if(!draft.sources.length)problems.push('Add at least one source.');
 if(!observationTime(draft.observedAt)||Date.parse(draft.observedAt)>now+60000)problems.push('Set a valid UTC observation date and time, not in the future.');
 if(draft.targetDate&&(!dateOnly(draft.targetDate)||draft.targetDate<draft.observedAt.slice(0,10)))problems.push('The forecast target must be a valid date on or after the observation date.');
 if(draft.category==='release-outlook'&&!draft.targetDate)problems.push('A release outlook needs a forecast target date.');
 const keys=new Set(references.map(articleProductKey));for(const product of inspected.products)if(!keys.has(articleProductKey(product)))problems.push(`Resolve product ${articleProductKey(product)} in the catalog.`);
 for(const f of draft.forecasts)if(!keys.has(f.productKey)||!f.rationale.trim()||!f.invalidation.trim()||!draft.targetDate)problems.push('Each forecast needs a linked product, target date, rationale and invalidation condition.');
 return [...new Set(problems)];
}
export type ArticleAction='submit'|'approve'|'publish'|'reject'|'archive'|'unpublish';
export function articleNextState(state:ArticleState,action:ArticleAction):ArticleState{
 if(action==='unpublish')return state;
 if(action==='archive')return 'archived';
 if(action==='submit'&&['draft','rejected'].includes(state))return 'needs-review';
 if(action==='approve'&&state==='needs-review')return 'approved';
 if(action==='publish'&&state==='approved')return 'published';
 if(action==='reject'&&['needs-review','approved'].includes(state))return 'rejected';
 throw new Error('This action is not available for the current revision.');
}
export function publicArticleDraft(draft:ArticleDraft):Omit<ArticleDraft,'evidenceNotes'>{const publicDraft={...parseArticleDraft(draft)};Reflect.deleteProperty(publicDraft,'evidenceNotes');return publicDraft}

// Linear comparison, bounded by the draft size: no quadratic document diff on a phone.
export function articleRevisionChanges(previous:ArticleDraft,current:ArticleDraft){
 return (Object.keys(emptyArticleDraft()) as (keyof ArticleDraft)[]).flatMap<{field:keyof ArticleDraft;before:string;after:string}>(field=>{
  const text=(value:ArticleDraft[keyof ArticleDraft])=>typeof value==='string'?value:JSON.stringify(value,null,2);
  const before=text(previous[field]),after=text(current[field]);if(before===after)return [];
  if(field!=='markdown')return [{field,before,after}];
  const oldLines=before.split('\n'),newLines=after.split('\n');let start=0,end=0;
  while(start<Math.min(oldLines.length,newLines.length)&&oldLines[start]===newLines[start])start++;
  while(end<Math.min(oldLines.length,newLines.length)-start&&oldLines[oldLines.length-end-1]===newLines[newLines.length-end-1])end++;
  return [{field,before:oldLines.slice(Math.max(0,start-2),oldLines.length-Math.max(0,end-2)).join('\n'),after:newLines.slice(Math.max(0,start-2),newLines.length-Math.max(0,end-2)).join('\n')}];
 });
}
