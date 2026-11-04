import type {Token,Tokens} from 'marked';

export type ArticleProductTarget={kind:'single'|'sealed';productId:number};
export type ArticleProductToken=Tokens.Generic&{type:'articleProduct';text:string;target:ArticleProductTarget|null;valid:boolean};
export const articleNameKey=(name:string)=>name.trim().toLowerCase();
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

export function matchArticleProduct<T extends ArticleProductTarget&{name:string}>(token:ArticleProductToken,products:T[]):T|undefined{
 if(!token.valid)return;
 const matches=products.filter(p=>token.target?p.kind===token.target.kind&&p.productId===token.target.productId:articleNameKey(p.name)===articleNameKey(token.text));
 return matches.length===1?matches[0]:undefined;
}
