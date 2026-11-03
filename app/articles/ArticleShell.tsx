"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Cross the server-enforced admin boundary with normal document navigation; vinext client links failed live staging acceptance. */
import type {ReactNode} from 'react';
import TopBar from '../TopBar';
import SiteFooter from '../SiteFooter';
import {usePreference,STRICTNESS_KEY,parseStrictness} from '../state/usePreference';
import {useAccount} from '../account/AccountProvider';
export default function ArticleShell({children}:{children:ReactNode}){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced'),account=useAccount();
 return <><link rel="sitemap" type="application/xml" href="/articles/sitemap.xml"/><TopBar active="articles" strictness={strictness} onStrictness={setStrictness}/><main className="detail-content articles-content"><div className="article-section-nav"><a href="/articles">← Articles</a><span>{account.user?.role==='admin'&&<a className="game-control" href="/admin/articles">Editorial Queue</a>}</span></div>{children}</main><SiteFooter/></>;
}
