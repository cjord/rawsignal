import {loadArticleLibrary} from '../data/load-detail';
import {pageSearch,type PageSearch} from '../state/page-search';
import ArticleLibrary from './ArticleLibrary';
export const dynamic='force-dynamic';
export const metadata={title:'Articles — Raw Signal',description:'TCG release outlooks and human-reviewed market analysis.'};
export default async function ArticlesPage({searchParams}:{searchParams:Promise<PageSearch>}){
 const query=new URLSearchParams(pageSearch(await searchParams)),result=await loadArticleLibrary(query);
 return <ArticleLibrary {...result} filters={{game:query.get('game')??'',category:query.get('category')??'',q:query.get('q')??''}}/>;
}
