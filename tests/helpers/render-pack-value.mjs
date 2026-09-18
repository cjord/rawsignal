import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {packValueBreakdown} from "../../core/domain/pack-ev.ts";

// Render the actual TSX component, with fixture data; no test route or production fixture.
const source=new URL("../../app/PackValueBreakdown.tsx",import.meta.url);
const require=createRequire(source),componentModule={exports:{}};
const code=ts.transpileModule(readFileSync(source,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function("require","module","exports",code)(name=>require(name==="../core/domain/formatters"?"../core/domain/formatters.ts":name),componentModule,componentModule.exports);
export function renderPackValueFixture(){
 const tier=(key,extra)=>({key,label:key,perPack:null,packsPerHit:null,cardCount:10,pricedCount:10,sumMarket:10,topMarket:5,topProductId:1,chase:false,...extra});
 const breakdown=packValueBreakdown([
  tier("Common",{perPack:7}),tier("Uncommon",{perPack:3}),
  tier("Alt art",{packsPerHit:12,sumMarket:120,chase:true}),
  tier("Signature",{packsPerHit:720,pricedCount:8,chase:true}),
  tier("Rare",{}),
 ]);
 return renderToStaticMarkup(createElement(componentModule.exports.default,{breakdown:{...breakdown,updatedAt:"2026-09-18"}}));
}
