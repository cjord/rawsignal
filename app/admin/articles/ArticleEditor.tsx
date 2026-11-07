"use client";
import {useId,useRef,useState} from 'react';
import {articleReviewProblems} from '../../../core/domain/articles';
import useArticleEditor from './useArticleEditor';
import ArticleProductPicker from './ArticleProductPicker';
import ArticleResearchFields from './ArticleResearchFields';
import ArticleRevisionPanel from './ArticleRevisionPanel';
import {ArticlePreview} from '../../articles/ArticleReader';
import useArticleProductLookup from './useArticleProductLookup';
import ArticleMetadata from './ArticleMetadata';
import ArticleEditorialActions from './ArticleEditorialActions';
import ArticleSectionNav from '../../articles/ArticleSectionNav';
import {articleDraftBackup,restoreArticleBackup} from '../../../core/domain/article-authoring';

export default function ArticleEditor({id}:{id?:string}){
 const editor=useArticleEditor(id),{record,draft,dirty,busy,change}=editor,textarea=useRef<HTMLTextAreaElement>(null),[view,setView]=useState('write'),prefix=useId().replaceAll(':','-');
 const frozen=!!record?.publishedAt;
 const section=(key:string)=>prefix+'-'+key;
 const sections=[['metadata','Article details'],['products','Product links'],['text','Article text'],['research','Evidence & forecasts'],['preview','Preview'],['checks','Checks'],['review','Review & publication'],...(record?[['history','Revision history']]:[])].map(([key,label])=>({id:section(key),label}));
 const {products,references,error:lookupError,loading:lookupLoading,retry:retryLookup}=useArticleProductLookup(draft.markdown,record?.references,record?.draft.markdown,editor.bindings);
 const problems=articleReviewProblems(draft,references);
 function insert(link:string){const start=textarea.current?.selectionStart??draft.markdown.length,end=textarea.current?.selectionEnd??start;change({...draft,markdown:draft.markdown.slice(0,start)+link+draft.markdown.slice(end)});requestAnimationFrame(()=>{textarea.current?.focus();textarea.current?.setSelectionRange(start+link.length,start+link.length)})}
 async function importFile(file:File|undefined){
  if(!file)return;if(file.size>(file.name.endsWith('.json')?256000:240000)){editor.setError('The import file is too large.');return}
  if(dirty&&!window.confirm('Replace your current article text? Download a copy first if you want to keep it.'))return;
  try{const markdown=await file.text();
   if(file.name.endsWith('.json')){const restored=restoreArticleBackup(JSON.parse(markdown));change(restored.draft);editor.setBindings(restored.bindings);editor.setError(restored.legacy?'Legacy backup loaded. Product names need catalog verification because this backup has no saved printing bindings.':'');return}
   if(markdown.length>60000)throw new Error('Article text is limited to 60,000 characters.');
   const title=markdown.match(/^# (.+)\r?\n/);change({...draft,title:draft.title||title?.[1]||'',markdown:title?markdown.slice(title[0].length):markdown});editor.setBindings([]);editor.setError('');
  }catch(cause){editor.setError('The import could not be loaded. Your text was kept. '+(cause as Error).message)}
 }
 function download(){const known=[...new Map([...(record?.references??[]),...references].map(p=>[p.kind+':'+p.productId,p])).values()];const backup=articleDraftBackup(draft,known,record?.revision??0,editor.bindings),url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(draft.slug||'article')+'-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

 return <><div className="article-editor-toolbar article-save-toolbar"><span role="status">{busy?'Working…':frozen?'Published · Read-only':dirty?'Unsaved changes':record?`Saved revision ${record.revision}`:'New draft'}{editor.message?` · ${editor.message}`:''}</span><div className="article-editor-actions"><button className="game-control" type="button" disabled={busy||frozen||!!id&&!record} onClick={()=>void editor.save()}>Save draft</button><button className="game-control" type="button" onClick={download}>Download draft backup</button><button className="game-control" type="button" disabled={busy||!record} onClick={()=>{if(!dirty||window.confirm('Replace your unsaved buffer with the latest saved revision? Download a copy first to keep it.'))void editor.load()}}>Load latest saved revision</button></div></div>
 <ArticleSectionNav label="Editor sections" sections={sections} onNavigate={target=>setView(target===section('preview')?'preview':'write')}/>
 {frozen&&<p className="account-notice">Published articles are read-only. Use Write a Follow-up below for new coverage. Withdrawing an article does not unlock its content.</p>}
 {lookupLoading&&<p role="status" className="games-note">Checking product links…</p>}{lookupError&&<div className="article-editor-actions"><p role="alert">{lookupError}</p><button type="button" className="game-control" disabled={busy} onClick={retryLookup}>Retry product links</button></div>}{editor.error&&<p className="account-form-error" role="alert">{editor.error}</p>}
 <div className="article-editor-mobile-tabs" role="group" aria-label="Editor view"><button type="button" aria-pressed={view==='write'} onClick={()=>setView('write')}>Write</button><button type="button" aria-pressed={view==='preview'} onClick={()=>setView('preview')}>Preview</button></div>
 <div className="article-editor-layout" data-view={view}><fieldset className="article-editor-fields" disabled={busy||frozen||!!id&&!record}><legend className="sr-only">Article draft</legend>
 <section><h2 id={section('metadata')} tabIndex={-1}>Article details</h2><ArticleMetadata draft={draft} change={change}/></section>
 <section id={section('products')} tabIndex={-1} aria-label="Product links"><ArticleProductPicker onInsert={insert} disabled={busy||frozen}/></section>
 <section><h2 id={section('text')} tabIndex={-1}>Article text</h2><label>Article text (Markdown)<textarea ref={textarea} rows={24} value={draft.markdown} maxLength={60000} onChange={e=>change({...draft,markdown:e.target.value})}/></label><p className="games-note">Use Markdown headings, lists and tables. Link products with [[Product name]], a collector number such as [[Ahri, Inquisitive SP3]], or [[Ahri, Inquisitive @ Vendetta]]. Use the catalog picker for an exact printing. Raw HTML and embedded images are omitted.</p><label>Import Markdown or a draft backup<input type="file" accept=".md,.markdown,.json,text/markdown,text/plain,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value=''}}/></label></section>
 <section id={section('research')} tabIndex={-1} aria-label="Evidence and forecasts"><ArticleResearchFields draft={draft} onChange={change} products={products}/></section></fieldset>
 <section className="article-editor-preview" aria-label="Article preview"><h2 id={section('preview')} tabIndex={-1}>Preview</h2><ArticlePreview article={{...draft,references}} products={products}/></section></div>
 <details id={section('checks')} tabIndex={-1} className="article-review-checks"><summary>Pre-publication checks ({problems.length})</summary>{problems.length?<ul>{problems.map(p=><li key={p}>{p}</li>)}</ul>:<p>Required fields and linked product identities are present. Human review is still required.</p>}</details>
 <div id={section('review')} tabIndex={-1}><ArticleEditorialActions editor={editor}/></div>{record&&<div id={section('history')} tabIndex={-1}><ArticleRevisionPanel draft={draft} history={editor.history} compare={editor.compare} onPage={editor.historyPage}/></div>}</>;
}
