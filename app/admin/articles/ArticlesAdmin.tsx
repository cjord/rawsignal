"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import TopBar from '../../TopBar';
import SiteFooter from '../../SiteFooter';
import {useAccount} from '../../account/AccountProvider';
import {usePreference,STRICTNESS_KEY,parseStrictness} from '../../state/usePreference';
import type {ArticleSummary} from '../../../core/domain/articles';
import ArticleEditor from './ArticleEditor';
import {requestJson} from '../../data/request-json';
function EditorialQueue(){
 const [rows,setRows]=useState<ArticleSummary[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();void requestJson(`/api/account/admin/articles?page=${page}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(({response,data})=>{if(!response.ok)throw new Error((data as {error?:string})?.error??'Unable to load the editorial queue.');if(!controller.signal.aborted){const result=data as {rows:ArticleSummary[];pages:number};setRows(result.rows);setPages(result.pages);setError('')}}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[page,refresh]);
 const move=(p:number)=>{setLoading(true);setPage(p)};
 return <section className="detail-section"><div className="article-editor-toolbar"><h2>Editorial Queue</h2><div className="article-editor-actions"><button className="game-control" type="button" onClick={()=>{setLoading(true);setRefresh(r=>r+1)}} disabled={loading}>Refresh</button><Link className="game-control" href="/admin/articles/new">New article</Link></div></div>{loading?<p role="status">Loading articles…</p>:error?<p role="alert">{error}</p>:<><div className="article-table-scroll"><table className="admin-table"><thead><tr><th>Article</th><th>Latest draft</th><th>Public revision</th><th>Updated</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th scope="row"><Link href={`/admin/articles/${r.id}`}>{r.title||'Untitled article'}</Link></th><td>{r.state.replaceAll('-',' ')} · revision {r.revision}</td><td>{r.publishedRevision??'Not published'}</td><td>{r.updatedAt.slice(0,10)}</td></tr>)}</tbody></table></div>{!rows.length&&<p>No articles yet. Create a draft to begin.</p>}<nav className="article-pagination" aria-label="Editorial queue pages"><button type="button" disabled={page<=1} onClick={()=>move(page-1)}>← Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page>=pages} onClick={()=>move(page+1)}>Next →</button></nav></>}</section>;
}
export default function ArticlesAdmin({id,create=false}:{id?:string;create?:boolean}){
 const account=useAccount(),[strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced');
 return <><TopBar strictness={strictness} onStrictness={setStrictness}/><main className="detail-content articles-admin"><header className="games-heading"><span className="games-eyebrow">Raw Signal · Administration</span><h1>{id||create?'Article Editor':'Editorial Queue'}</h1></header><nav className="article-editor-actions" aria-label="Editorial navigation"><Link className="game-control" href="/admin">Administration</Link><Link className="game-control" href="/admin/articles">Editorial Queue</Link><Link className="game-control" href="/articles">Public articles</Link></nav>{account.loading?<p role="status">Checking administrator access…</p>:account.user?.role!=='admin'?<section className="detail-section"><p>Administrator access is required.</p><Link href="/account">Sign in</Link></section>:id||create?<ArticleEditor key={`${account.user.id}:${id??'new'}`} id={id}/>:<EditorialQueue key={account.user.id}/>}</main><SiteFooter/></>;
}
