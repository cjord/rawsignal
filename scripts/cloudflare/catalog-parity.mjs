import path from "node:path";
import {pathToFileURL} from "node:url";

export const parityCases=[
 {name:"pokemon-illustration-rares",params:{mode:"singles",market:"pokemon",rarity:"illustration-rares"}},
 {name:"pokemon-special-illustration-rares",params:{mode:"singles",market:"pokemon",rarity:"special-illustration-rares"}},
 {name:"riftbound-overnumbered",params:{mode:"singles",market:"riftbound",rarity:"overnumbered"}},
 {name:"pokemon-sealed",params:{mode:"sealed",market:"pokemon",type:"all"}},
 {name:"riftbound-sealed",params:{mode:"sealed",market:"riftbound",type:"all"}},
 {name:"onepiece-sealed",params:{mode:"sealed",market:"onepiece",type:"all"}},
];

const singlesKeys=["productId","game","section","name","set","year","rarity","number","marketPrice","lowPrice","midPrice","highPrice","printing"];
const sealedKeys=["productId","game","name","set","category","msrp","marketPrice","midPrice","msrpSource"];
const project=(item,keys)=>Object.fromEntries(keys.map(key=>[key,item[key]??null]));
const canonical=(item,mode)=>project(item,mode==="sealed"?sealedKeys:singlesKeys);
const sorted=value=>[...value].sort((a,b)=>String(a).localeCompare(String(b)));

async function collect(base,testCase,fetcher){
 const records=[];let page=1,pages=1,source="unknown",facets={sets:[],productTypes:[]};
 do{
  const url=new URL("/api/catalog",base);for(const [key,value] of Object.entries({...testCase.params,page,perPage:50,sort:"name",direction:"asc",signal:"leaderboard",strictness:"balanced"}))url.searchParams.set(key,String(value));
  const response=await fetcher(url);if(!response.ok)throw new Error(`${testCase.name} returned HTTP ${response.status} from ${base}`);
  const body=await response.json();if(!Array.isArray(body.items)||!Number.isInteger(body.pages))throw new Error(`${testCase.name} returned an invalid catalog response`);
  records.push(...body.items.map(item=>canonical(item,testCase.params.mode)));pages=body.pages;source=body.source;facets=body.facets??facets;page++;
 }while(page<=pages);
 // Name ties fall through to the server's internal candidate order, which is not part of
 // the parity contract (D5 pinned it to product_id, older deployments used SELECT order) —
 // re-sort by (name, productId) so cross-deployment comparisons stay tie-insensitive.
 records.sort((a,b)=>String(a.name).localeCompare(String(b.name))||a.productId-b.productId);
 return{source,records,facets:{sets:sorted(facets.sets??[]),productTypes:sorted(facets.productTypes??[])}};
}

export async function compareCatalogEndpoints({baseline,candidate,fetcher=fetch,cases=parityCases,requireDatabase=true}){
 const results=[];
 for(const testCase of cases){
  const [expected,actual]=await Promise.all([collect(baseline,testCase,fetcher),collect(candidate,testCase,fetcher)]);
  const recordsMatch=JSON.stringify(expected.records)===JSON.stringify(actual.records),facetsMatch=JSON.stringify(expected.facets)===JSON.stringify(actual.facets),databaseReady=!requireDatabase||actual.source==="database";
  results.push({name:testCase.name,baselineSource:expected.source,candidateSource:actual.source,baselineCount:expected.records.length,candidateCount:actual.records.length,recordsMatch,facetsMatch,databaseReady,pass:recordsMatch&&facetsMatch&&databaseReady});
 }
 return{pass:results.every(result=>result.pass),results};
}

const args=process.argv.slice(2),option=name=>{const index=args.indexOf(`--${name}`);return index>=0?args[index+1]:undefined};
async function main(){
 const baseline=option("baseline"),candidate=option("candidate");if(!baseline||!candidate)throw new Error("Use --baseline URL and --candidate URL");
 const report=await compareCatalogEndpoints({baseline,candidate,requireDatabase:!args.includes("--allow-feed-candidate")});console.table(report.results);if(!report.pass)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
