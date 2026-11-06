import type {Token,Tokens} from 'marked';

export type ArticleProductTarget={kind:'single'|'sealed';productId:number};
export type ArticleNamedProduct=ArticleProductTarget&{name:string;set?:string;number?:string;aliases?:string[]};
export type ArticleProductToken=Tokens.Generic&{type:'articleProduct';text:string;target:ArticleProductTarget|null;valid:boolean};
export const articleNameKey=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const articleProductMarkup=(p:ArticleProductTarget&{name:string})=>`[[${p.name.replace(/[[\]\r\n|]/g,' ').replaceAll('::',':')}::${p.kind}:${p.productId}]]`;
export const isArticleProductToken=(token:Token):token is ArticleProductToken=>token.type==='articleProduct';

// An inline tokenizer keeps code, escapes, tables and the Markdown security rules intact.
// IDs disambiguate printings; the text is always rendered as text, never HTML/Markdown.
export const articleProductExtension={
 name:'articleProduct',level:'inline' as const,
 start:(source:string)=>source.indexOf('[['),
 tokenizer(source:string):ArticleProductToken|undefined{
  const match=/^\[\[([^[\]\r\n]{1,500})\]\]/.exec(source);if(!match)return;
  const raw=match[0],parts=match[1].split('::'),text=parts[0].trim(),id=parts[1]?.match(/^(single|sealed):([1-9]\d{0,8})$/);
  const valid=!!text&&text.length<=300&&parts.length<=2&&(parts.length===1||!!id);
  return {type:'articleProduct',raw,text,target:id?{kind:id[1] as 'single'|'sealed',productId:Number(id[2])}:null,valid};
 }
};

const numberKey=(value:string)=>articleNameKey(value).replace(/\d+/g,digits=>String(Number(digits)));
const shortNumber=(value:string)=>numberKey(value).split('/')[0];
const unique=<T extends ArticleProductTarget>(items:T[])=>{
 const values=[...new Map(items.map(p=>[`${p.kind}:${p.productId}`,p])).values()];return values.length===1?values[0]:undefined;
};
export function articleProductQuery(value:string){
 const parts=articleNameKey(value).split('@');if(parts.length>2||parts.some(p=>!p.trim()))return null;
 const fullName=parts[0].trim(),set=parts[1]?.trim(),match=fullName.match(/^(.*?)\s+#?([a-z]{0,4}\d+[a-z]?\*?(?:\/\d+)?)$/i);
 return {fullName,set,name:match?.[1]??fullName,number:match?.[2]??''};
}
export function articleProductSearchNames(value:string){
 const query=articleProductQuery(value);return query?[...new Set([query.fullName,query.name])]:[];
}
const baseName=(value:string)=>articleNameKey(value).replace(/(?:\s+\((?:alternate art|overnumbered|signature|[^()]*special art card|metal|best of|prize wall)\))+$/g,'');
function regularProduct(p:ArticleNamedProduct){
 if(p.kind!=='single'||!/^\d+(?:\/\d+)?$/.test(p.number??''))return false;
 const [number,total]=(p.number??'').split('/').map(Number);return total===undefined||number<=total;
}
// Exact names first; an optional collector number/set narrows the printing. With
// duplicated bare names, only a unique regular numeric printing gets a default.
export function resolveArticleProductName<T extends ArticleNamedProduct>(value:string,products:T[]):T|undefined{
 const query=articleProductQuery(value);if(!query)return;
 const scoped=products.filter(p=>!query.set||articleNameKey(p.set??'')===query.set);
 const exact=scoped.filter(p=>articleNameKey(p.name)===query.fullName);
 if(exact.length)return unique(exact)??unique(exact.filter(regularProduct));
 if(!query.number)return;
 const numberMatches=scoped.filter(p=>(articleNameKey(p.name)===query.name||baseName(p.name)===query.name)&&(query.number.includes('/')?numberKey(p.number??'')===numberKey(query.number):shortNumber(p.number??'')===shortNumber(query.number)));
 return unique(numberMatches);
}
export function matchArticleProduct<T extends ArticleNamedProduct>(token:ArticleProductToken,products:T[]):T|undefined{
 if(!token.valid)return;
 if(token.target)return unique(products.filter(p=>p.kind===token.target!.kind&&p.productId===token.target!.productId));
 const bound=products.filter(p=>p.aliases?.some(name=>articleNameKey(name)===articleNameKey(token.text)));
 // aliases:[] means an exact-ID reference, not permission to bind a new name.
 return bound.length?unique(bound):resolveArticleProductName(token.text,products.filter(p=>p.aliases===undefined));
}
