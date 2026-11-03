import {createRoot} from 'react-dom/client';
import AccountProvider from '../../app/account/AccountProvider';
import ArticlesAdmin from '../../app/admin/articles/ArticlesAdmin';
import ArticleReader from '../../app/articles/ArticleReader';
import {emptyArticleDraft} from '../../core/domain/articles';
const product={kind:'single' as const,productId:123,name:'Ezreal, Dashing',set:'Radiance',game:'riftbound',number:'180*',printing:'Foil',image:null,marketPrice:510,midPrice:550,metrics:{snapshotId:'test:2026-10-27',asOfDate:'2026-10-27',change7:null,change30:null,low30:null,high30:null,regime:null}};
const article={...emptyArticleDraft(),title:'Radiance release outlook',slug:'radiance-outlook',summary:'Dated estimates alongside current market history.',observedAt:'2026-10-27T12:00:00Z',targetDate:'2026-11-22',sources:['https://www.tcgplayer.com/'],markdown:'## Singles outlook\n\n[Ezreal Signature](/cards/123) was quoted at **$470**. [Ezreal again](/cards/123) has a separate current chart.\n\n|Card|Presale|Current ask|Outlook|\n|---|---|---|---|\n|[Ezreal Signature](/cards/123)|$700|$510|$400–$550|\n\n<script>window.articleUnsafe=true</script>\n\n[Unsafe](javascript:alert(1))',revision:1,publishedAt:'2026-10-27T13:00:00Z',firstPublishedAt:'2026-10-27T13:00:00Z',references:[product],releases:[{revision:1,publishedAt:'2026-10-27T13:00:00Z',note:''}]};
const editing=new URLSearchParams(location.search).has('editor');
createRoot(document.getElementById('fixture')!).render(<AccountProvider enabled={editing}>{editing?<ArticlesAdmin create/>:<ArticleReader article={article} products={[product]}/>}</AccountProvider>);
