"use client";
import type {ArticleProduct,PublicArticle} from '../../core/domain/articles';
import {articleObservationLabel} from '../../core/domain/articles';
import ArticleBody from './ArticleBody';
import ArticleShell from './ArticleShell';
export function ArticlePreview({article,products=[]}:{article:Pick<PublicArticle,'title'|'summary'|'byline'|'observedAt'|'targetDate'|'aiAssisted'|'disclosure'|'markdown'|'sources'|'forecasts'|'references'>;products?:ArticleProduct[]}){
 return <><header className="article-reader-heading"><h1>{article.title||'Untitled article'}</h1><p>{article.summary}</p><div className="article-byline">{article.byline}{article.aiAssisted?' · AI-assisted':''}</div><p className="article-evidence-date">Evidence as of: <time dateTime={article.observedAt||undefined}>{articleObservationLabel(article.observedAt)}</time>{article.targetDate&&<> · Outlook target: <time dateTime={article.targetDate}>{articleObservationLabel(article.targetDate)}</time></>}</p>{article.disclosure&&<p className="article-disclosure">{article.disclosure}</p>}</header><ArticleBody markdown={article.markdown} products={products} references={article.references} forecasts={article.forecasts} sources={article.sources}/><p className="games-note">Quoted prices and editorial forecasts remain dated. Card previews show current, separately dated market history. Predictions are estimates, not guaranteed prices.</p></>;
}
export default function ArticleReader({article,products}:{article:PublicArticle;products:ArticleProduct[]}){
 const latest=article.releases[0]?.revision,old=latest!==article.revision;
 return <ArticleShell><article className="article-reader">{old&&<p className="account-notice">You are reading a previous published revision. <a href={`/articles/${article.slug}`}>Read the current article →</a></p>}<ArticlePreview article={article} products={products}/><section className="article-version-history"><h2>Publication history</h2><p>First published {article.firstPublishedAt.slice(0,10)} · Reading revision {article.revision}, published {article.publishedAt.slice(0,10)}</p><ul>{article.releases.map(r=><li key={r.revision}><a href={`/articles/${article.slug}?revision=${r.revision}`}>Revision {r.revision} · {r.publishedAt.slice(0,10)}</a>{r.note&&<span> — {r.note}</span>}</li>)}</ul></section></article></ArticleShell>;
}
