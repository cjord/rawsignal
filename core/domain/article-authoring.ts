import {articleLookupTargets,articleProductKey,emptyArticleDraft,inspectArticleMarkdown,parseArticleDraft,type ArticleDraft,type ArticleReference} from './articles.ts';
import {articleNameKey,matchArticleProduct} from './article-product-links.ts';

export type ArticleBinding=Pick<ArticleReference,'kind'|'productId'>&{aliases:string[]};
// Backups carry identities, never prices or trusted catalog metadata. Resolve every ID
// against the catalog again before saving. Unknown versions must not silently degrade.
export function parseArticleBindings(value:unknown,markdown:string):ArticleBinding[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>40)throw new RangeError('Invalid saved product bindings.');
 const names=new Set(inspectArticleMarkdown(markdown).names.map(articleNameKey)),seen=new Set<string>();let count=0,size=0;
 return value.flatMap(b=>{
  if(!b||!['single','sealed'].includes(b.kind)||!Number.isSafeInteger(b.productId)||b.productId<1||b.productId>=1e9||!Array.isArray(b.aliases)||!b.aliases.length||b.aliases.length>40)throw new RangeError('Invalid saved product binding.');
  const aliases:string[]=[];
  for(const alias of b.aliases){
   if(typeof alias!=='string'||!alias.trim()||alias.length>300||[...alias].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new RangeError('Invalid saved product name.');
   count++;size+=alias.length;const key=articleNameKey(alias);
   if(!names.has(key))continue;
   if(seen.has(key))throw new RangeError('Conflicting saved product bindings.');
   seen.add(key);aliases.push(alias);
  }
  if(count>40||size>6000)throw new RangeError('Too many saved product names.');
  return aliases.length?[{kind:b.kind,productId:b.productId,aliases}]:[];
 });
}
export function articleBoundLookup(inspected:ReturnType<typeof inspectArticleMarkdown>,saved:ArticleReference[]=[],savedMarkdown='',bindings:ArticleBinding[]=[]){
 const pinned=new Map(bindings.flatMap(b=>b.aliases.map(alias=>[articleNameKey(alias),b] as const)));
 const lookup=articleLookupTargets({...inspected,names:inspected.names.filter(n=>!pinned.has(articleNameKey(n)))},saved,savedMarkdown);
 const targets=new Map(lookup.products.map(p=>[articleProductKey(p),p]));
 for(const name of inspected.names){const binding=pinned.get(articleNameKey(name));if(!binding)continue;const key=articleProductKey(binding),previous=targets.get(key);targets.set(key,{kind:binding.kind,productId:binding.productId,aliases:[...(previous?.aliases??[]),name]})}
 return {...lookup,products:[...targets.values()]};
}
export function articleDraftBackup(draft:ArticleDraft,references:ArticleReference[],revision=0,restored:ArticleBinding[]=[]){
 const bindings=new Map<string,ArticleBinding>();
 const saved=parseArticleBindings(restored,draft.markdown);
 for(const name of inspectArticleMarkdown(draft.markdown).names){const ref=saved.find(b=>b.aliases.some(a=>articleNameKey(a)===articleNameKey(name)))??matchArticleProduct({type:'articleProduct',raw:'',text:name,target:null,valid:true},references);if(!ref)continue;const key=articleProductKey(ref),entry=bindings.get(key)??{kind:ref.kind,productId:ref.productId,aliases:[]};entry.aliases.push(name);bindings.set(key,entry)}
 return {format:'raw-signal-article',version:1,draft:parseArticleDraft(draft,{buffer:true}),revision,bindings:[...bindings.values()]};
}
export function restoreArticleBackup(value:unknown){
 if(!value||typeof value!=='object')throw new Error('Invalid article backup.');
 const backup=value as ReturnType<typeof articleDraftBackup>;
 const legacy=!('version' in value)&&!('format' in value);
 if(!legacy&&(backup.version!==1||backup.format!=='raw-signal-article'))throw new Error('Unsupported article backup version.');
 const draft=parseArticleDraft(backup.draft,{buffer:true}),bindings=parseArticleBindings(legacy?undefined:backup.bindings,draft.markdown);
 return {draft,bindings,legacy};
}
export function articleFollowUpDraft(source:ArticleDraft):ArticleDraft{
 return {...emptyArticleDraft(),title:`${source.title.slice(0,160)} — Follow-up`,game:source.game,setName:source.setName,category:source.category,byline:source.byline,aiAssisted:source.aiAssisted,disclosure:source.disclosure,sources:[`https://rawsignal.cards/articles/${source.slug}`],markdown:`## What has changed\n\nWrite new analysis using newly checked evidence.\n\n[Read the earlier article](/articles/${source.slug}).`};
}
