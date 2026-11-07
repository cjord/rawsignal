"use client";
export type ArticleSection={id:string;label:string};
export default function ArticleSectionNav({sections,label='In this article',onNavigate}:{sections:ArticleSection[];label?:string;onNavigate?:(id:string)=>void}){
 if(!sections.length)return null;
 return <nav className="article-jump-nav" aria-label={label}><strong>{label}</strong><ul>{sections.map(section=><li key={section.id}><a href={`#${section.id}`} onClick={event=>{
  event.preventDefault();onNavigate?.(section.id);
  requestAnimationFrame(()=>{
   const target=document.getElementById(section.id);if(!target)return;
   for(let parent:HTMLElement|null=target;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
   const details=target.querySelector('details');if(details)details.open=true;
   target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});
  });
 }}>{section.label}</a></li>)}</ul></nav>;
}
