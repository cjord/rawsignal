"use client";

// A popover dwell is the navigation-intent signal (todo F1): warm the detail route during
// idle time so a cold server isolate finishes its catalog-repository build (the expensive
// part of detail SSR) before the user clicks through. The row's history request already
// primed the browser HTTP cache for /api/history.
const warmed=new Set<string>();

export function warmDetailPage(href:string){
 if(typeof window==="undefined"||warmed.has(href))return;
 if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
 warmed.add(href);
 const run=()=>{void fetch(href,{credentials:"same-origin"}).then(response=>response.arrayBuffer()).catch(()=>warmed.delete(href))};
 if(typeof window.requestIdleCallback==="function")window.requestIdleCallback(run,{timeout:2500});else window.setTimeout(run,350);
}
