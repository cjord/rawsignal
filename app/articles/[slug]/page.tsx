import {notFound} from 'next/navigation';
import {loadArticleReader} from '../../data/load-detail';
import {pageSearch,type PageSearch} from '../../state/page-search';
import ArticleReader from '../ArticleReader';
import ArticleShell from '../ArticleShell';
export const dynamic='force-dynamic';
export async function generateMetadata({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<PageSearch>}){
 const {slug}=await params,query=new URLSearchParams(pageSearch(await searchParams)),revision=query.has('revision')?Number(query.get('revision')):undefined;
 const {article}=await loadArticleReader(slug,revision);
 if(!article)return {title:'Article unavailable — Raw Signal',robots:{index:false,follow:false}};
 return {title:`${article.title} — Raw Signal`,description:article.summary,alternates:{canonical:`https://rawsignal.cards/articles/${slug}`},...(revision?{robots:{index:false,follow:true}}:{})};
}
export default async function ArticlePage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<PageSearch>}){
 const {slug}=await params,query=new URLSearchParams(pageSearch(await searchParams)),revision=query.has('revision')?Number(query.get('revision')):undefined;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100||revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))notFound();
 const result=await loadArticleReader(slug,revision);
 if(result.error)return <ArticleShell><section className="detail-section" role="alert"><h1>Article unavailable</h1><p>{result.error}</p><a href={`/articles/${slug}`}>Retry</a></section></ArticleShell>;
 if(!result.article)notFound();
 return <><link rel="canonical" href={`https://rawsignal.cards/articles/${slug}`}/>{revision&&<meta name="robots" content="noindex,follow"/>}<ArticleReader article={result.article} products={result.products}/></>;
}
