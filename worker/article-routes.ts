import type {AccountEnv} from './account-auth.ts';
import type {D1DatabaseLike} from '../db/repository.ts';
import {ArticleError,articleRevisions,listArticles,readAdminArticle,readPublicArticle,readArticleProducts,saveArticleDraft,transitionArticle} from '../db/articles.ts';
import {articleListOptions,parseArticleDraft,type ArticleAction,type ArticleReference} from '../core/domain/articles.ts';
import {accountJson} from './account-http.ts';
import {boundedJson} from './bounded-json.ts';
import {communityLimit} from './community-limits.ts';

const publicJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const articleApiPath=(path:string)=>path==='/api/articles'||path.startsWith('/api/articles/');
// A separate no-store sitemap avoids retaining withdrawn articles in the market sitemap cache.
export async function handleArticleSitemap(env:AccountEnv){
 if(env.ARTICLES_ENABLED!=='true')return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const db=env.DB as D1DatabaseLike,rows=(await db.prepare('SELECT slug,published_at AS date FROM articles WHERE published_revision IS NOT NULL ORDER BY slug LIMIT 5000').all<{slug:string;date:string}>()).results??[];
  const escape=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
  const urls=[{slug:'',date:''},...rows].map(r=>`<url><loc>https://rawsignal.cards/articles${r.slug?'/'+escape(r.slug):''}</loc>${r.date?`<lastmod>${escape(r.date)}</lastmod>`:''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-store'}});
 }catch{return new Response('Article sitemap unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
}
export async function handlePublicArticles(request:Request,env:AccountEnv){
 if(!['GET','HEAD'].includes(request.method))return publicJson({error:'Method not allowed'},405);
 if(env.ARTICLES_ENABLED!=='true')return publicJson({error:'Articles are not enabled yet.'},503);
 const db=env.DB as D1DatabaseLike;if(!db)return publicJson({error:'Article storage is unavailable.'},503);
 try{
  const url=new URL(request.url),slug=url.pathname.slice('/api/articles'.length).replace(/^\//,'');
  if(!slug)return publicJson(await listArticles(db,articleListOptions(url.searchParams)));
  if(slug==='products'){
   const values=(url.searchParams.get('ids')??'').split(',').filter(Boolean);if(values.length>40||values.some(v=>! /^(single|sealed):[1-9]\d{0,8}$/.test(v)))return publicJson({error:'Invalid product references.'},400);
   const targets=values.map(v=>{const [kind,id]=v.split(':');return {kind:kind as ArticleReference['kind'],productId:Number(id)}});
   return publicJson({products:await readArticleProducts(db,targets)});
  }
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100)return publicJson({error:'Not found'},404);
  const revision=url.searchParams.has('revision')?Number(url.searchParams.get('revision')):undefined;
  if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))return publicJson({error:'Invalid revision'},400);
  const article=await readPublicArticle(db,slug,revision);return article?publicJson({article}):publicJson({error:'Not found'},404);
 }catch(cause){return publicJson({error:cause instanceof ArticleError||cause instanceof RangeError?cause.message:'Articles are temporarily unavailable.'},cause instanceof ArticleError?cause.status:cause instanceof RangeError?400:503)}
}
export async function handleAdminArticles(request:Request,env:AccountEnv,actor:string){
 if(env.ARTICLES_ENABLED!=='true')return accountJson({error:'Apply the article migration and enable Articles before using the editor.'},503);
 const db=env.DB as D1DatabaseLike,url=new URL(request.url),id=url.pathname.split('/')[5];
 if(url.pathname.split('/').length>6||id&&!/^[a-zA-Z0-9-]{1,100}$/.test(id))return accountJson({error:'Invalid article ID.'},400);
 try{
  if(request.method==='GET')return adminRead(db,url,id);
  if(!['POST','PUT'].includes(request.method))return accountJson({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==new URL(env.AUTH_BASE_URL!).origin)return accountJson({error:'Invalid origin.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return accountJson({error:'JSON required.'},415);
  const limited=await communityLimit(env,'write',actor);if(limited)return limited;
  let body;try{body=await boundedJson(request,140000)}catch{throw new ArticleError('Invalid or oversized article.',400)}
  if(!Number.isSafeInteger(body?.revision)||body.revision<0)throw new ArticleError('A saved revision is required.',400);
  if(body.action){
   if(!id||!validAction(body))throw new ArticleError('Invalid editorial action.',400);
   return accountJson({article:await transitionArticle(db,actor,id,body.revision,body.action as ArticleAction,body.note,body.reviewed===true)});
  }
  let draft;try{draft=parseArticleDraft(body.draft)}catch(cause){throw new ArticleError(cause instanceof Error?cause.message:'Invalid article.',400)}
  return accountJson({article:await saveArticleDraft(db,actor,{id,revision:body.revision,draft})});
 }catch(cause){
  if(cause instanceof ArticleError)return accountJson({error:cause.message},cause.status);
  if(cause instanceof RangeError)return accountJson({error:cause.message},400);
  if(cause instanceof Error&&/UNIQUE constraint failed: articles.slug/.test(cause.message))return accountJson({error:'That article URL is already in use.'},409);
  return accountJson({error:'The article request could not be confirmed. Keep your text and reload the saved revision before retrying.'},503);
 }
}
const validOptionalRevision=(n:number|undefined)=>n===undefined||Number.isSafeInteger(n)&&n>0;
function validAction(body:{action:unknown;note:unknown}){return ['submit','approve','publish','reject','archive','unpublish'].includes(String(body.action))&&typeof body.note==='string'&&body.note.length<=500}

async function adminRead(db:D1DatabaseLike,url:URL,id:string|undefined){
 if(!id)return accountJson(await listArticles(db,{...articleListOptions(url.searchParams),admin:true}));
 const revision=url.searchParams.has('revision')?Number(url.searchParams.get('revision')):undefined;
 const before=url.searchParams.has('before')?Number(url.searchParams.get('before')):undefined;
 if(!validOptionalRevision(revision)||!validOptionalRevision(before))throw new ArticleError('Invalid revision.',400);
 const article=await readAdminArticle(db,id,revision);
 return article?accountJson({article,history:await articleRevisions(db,id,before)}):accountJson({error:'Article not found.'},404);
}
