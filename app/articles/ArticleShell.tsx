"use client";
import Link from 'next/link';
import type {ReactNode} from 'react';
import TopBar from '../TopBar';
import SiteFooter from '../SiteFooter';
import {usePreference,STRICTNESS_KEY,parseStrictness} from '../state/usePreference';
import {useAccount} from '../account/AccountProvider';
export default function ArticleShell({children}:{children:ReactNode}){
 const [strictness,setStrictness]=usePreference(STRICTNESS_KEY,parseStrictness,'balanced'),account=useAccount();
 return <><link rel="sitemap" type="application/xml" href="/articles/sitemap.xml"/><TopBar active="articles" strictness={strictness} onStrictness={setStrictness}/><main className="detail-content articles-content"><div className="article-section-nav"><Link href="/articles">← Articles</Link><span>{account.user?.role==='admin'&&<Link className="game-control" href="/admin/articles">Editorial Queue</Link>}</span></div>{children}</main><SiteFooter/></>;
}
