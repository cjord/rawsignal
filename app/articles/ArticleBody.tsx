"use client";
import {useId,useMemo,useState,type ReactNode} from 'react';
import type {MarkedToken,Token,Tokens} from 'marked';
import {articleHref,articleLinkProduct,articleProductHref,articleProductKey,articleTokens,type ArticleForecast,type ArticleProduct,type ArticleReference} from '../../core/domain/articles';
import {isArticleProductToken,matchArticleProduct,type ArticleProductToken} from '../../core/domain/article-product-links';
import {usePriceHistoryBatch} from '../data/usePriceHistoryBatch';
import ArticleCardLink from './ArticleCardLink';
import ArticleSectionNav from './ArticleSectionNav';
import {articleOutline} from '../../core/domain/article-outline';

const readable=(s:string)=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,entity:string)=>({'amp':'&','lt':'<','gt':'>','quot':'"','#39':"'"}[entity]??''));
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The named overflow region needs keyboard scrolling on narrow screens. */
function ForecastTable({forecasts,references,link}:{forecasts:ArticleForecast[];references:ArticleReference[];link:(ref:ArticleReference)=>ReactNode}){
 return <div className="article-table-scroll" role="region" aria-label="Price outlook table" tabIndex={0}><table><thead><tr>{['Product','Range (USD)','Basis','Confidence','Rationale','Changes to watch'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{forecasts.map((f,i)=>{const ref=references.find(r=>articleProductKey(r)===f.productKey);return <tr key={i}><th scope="row">{ref?link(ref):f.productKey}</th><td>${f.low}–${f.high}</td><td>{f.basis}</td><td>{f.confidence}</td><td>{f.rationale}</td><td>{f.invalidation}</td></tr>})}</tbody></table></div>;
}
export default function ArticleBody({markdown,products=[],references=products,forecasts=[],sources=[]}:{markdown:string;products?:ArticleProduct[];references?:ArticleReference[];forecasts?:ArticleForecast[];sources?:string[]}){
 const tokens=useMemo(()=>articleTokens(markdown),[markdown]),{history,ensure}=usePriceHistoryBatch();
 const prefix=useId().replaceAll(':','-'),headings=useMemo(()=>articleOutline(tokens,prefix),[tokens,prefix]);
 const sections=[...headings.values(),...(forecasts.length?[{id:`${prefix}-outlook`,label:'Price outlook'}]:[]),...(sources.length?[{id:`${prefix}-sources`,label:'Sources'}]:[])];
 const [activePreview,setActivePreview]=useState<string|null>(null);
 const index=useMemo(()=>new Map(products.map(p=>[articleProductKey(p),p])),[products]);
 const renderProduct=(token:ArticleProductToken,key:string,inLink:boolean)=>{
  if(inLink)return <span key={key}>{token.text}</span>;
  const ref=matchArticleProduct(token,references);
  return ref?<ArticleCardLink key={key} href={articleProductHref(ref)} product={index.get(articleProductKey(ref))??{...ref,marketPrice:null,midPrice:null}} histories={history} ensure={ensure} activePreview={activePreview} onPreviewChange={setActivePreview}>{token.text}</ArticleCardLink>:<span key={key} className="article-unresolved-reference" title="Choose the exact product in the article editor">{token.raw}</span>;
 };
 const children=(token:MarkedToken,depth:number,inLink:boolean)=>'tokens'in token&&token.tokens?render(token.tokens,depth+1,inLink||token.type==='link'):null;
 const render=(list:Token[],depth=0,inLink=false):ReactNode=>depth>24?null:list.map((generic,i)=>{
  const key=`${depth}:${i}`;
  if(isArticleProductToken(generic))return renderProduct(generic,key,inLink);
  const token=generic as MarkedToken,nested=children(token,depth,inLink);
  switch(token.type){
   case 'space':case 'def':return null;
   case 'heading':{const Tag=`h${Math.max(2,Math.min(6,token.depth))}` as 'h2';return <Tag key={key} id={headings.get(generic)?.id} tabIndex={-1}>{nested}</Tag>}
   case 'paragraph':return <p key={key}>{nested}</p>;
   case 'text':return <span key={key}>{nested??readable(token.text)}</span>;
   case 'escape':return readable(token.text);
   case 'strong':return <strong key={key}>{nested}</strong>;
   case 'em':return <em key={key}>{nested}</em>;
   case 'del':return <del key={key}>{nested}</del>;
   case 'br':return <br key={key}/>;
   case 'hr':return <hr key={key}/>;
   case 'code':return <pre key={key}><code>{token.text}</code></pre>;
   case 'codespan':return <code key={key}>{readable(token.text)}</code>;
   case 'blockquote':return <blockquote key={key}>{nested}</blockquote>;
   case 'list':{const Tag=token.ordered?'ol':'ul';return <Tag key={key}>{token.items.map((item,j)=><li key={j}>{render(item.tokens,depth+1)}</li>)}</Tag>}
   case 'link':{const href=articleHref(token.href);if(!href)return <span key={key}>{nested}</span>;const reference=articleLinkProduct(href);return reference?<ArticleCardLink key={key} href={href} product={index.get(articleProductKey(reference))} histories={history} ensure={ensure} activePreview={activePreview} onPreviewChange={setActivePreview}>{nested}</ArticleCardLink>:<a key={key} href={href} rel={href.startsWith('https:')?'noopener noreferrer':undefined}>{nested}</a>}
   case 'table':return <div className="article-table-scroll" key={key}><table><thead><tr>{token.header.map((cell,j)=><th scope="col" key={j}>{render(cell.tokens,depth+1)}</th>)}</tr></thead><tbody>{token.rows.map((row,j)=><tr key={j}>{row.map((cell:Tokens.TableCell,k:number)=><td key={k}>{render(cell.tokens,depth+1)}</td>)}</tr>)}</tbody></table></div>;
   default:return <span className="article-unsupported" key={key}>[Unsupported embedded content omitted]</span>;
  }
 });
 return <><ArticleSectionNav sections={sections}/><div className="article-prose">{render(tokens)}{forecasts.length>0&&<section><h2 id={`${prefix}-outlook`} tabIndex={-1}>Price outlook</h2><ForecastTable forecasts={forecasts} references={references} link={ref=><ArticleCardLink href={articleProductHref(ref)} product={index.get(articleProductKey(ref))??{...ref,marketPrice:null,midPrice:null}} histories={history} ensure={ensure} activePreview={activePreview} onPreviewChange={setActivePreview}>{ref.name}</ArticleCardLink>}/></section>}{sources.length>0&&<section className="article-sources"><h2 id={`${prefix}-sources`} tabIndex={-1}>Sources</h2><ul>{sources.map((source,i)=><li key={i}>{articleHref(source)?<a href={articleHref(source)!} rel="noopener noreferrer">{source}</a>:<span>{source} (invalid source link)</span>}</li>)}</ul></section>}</div></>;
}
