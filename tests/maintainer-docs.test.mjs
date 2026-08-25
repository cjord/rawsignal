import assert from "node:assert/strict";
import {access,readFile} from "node:fs/promises";
import test from "node:test";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("maintainer documentation identifies the production workflow and data boundaries",async()=>{
 const [readme,agents,architecture,sources,legacy,ingestion,ignore,packageText,research]=await Promise.all([
  read("README.md"),read("AGENTS.md"),read("docs/architecture.md"),read("docs/data-sources.md"),read("docs/legacy-artifacts.md"),read("docs/data-ingestion.md"),read(".gitignore"),read("package.json"),read("research.mjs"),
 ]);
 const pkg=JSON.parse(packageText);
 assert.equal(pkg.name,"raw-signal");
 assert.equal(pkg.scripts["data:sync:singles"],"node sync-tcgcsv.mjs");
 assert.equal(pkg.scripts["data:sync:sealed"],"node sync-sealed.mjs");
 for(const section of ["Local development","Quality checks","Data refresh","Architecture","Deployment","Market-data interpretation"])assert.match(readme,new RegExp(`## ${section}`));
 assert.match(readme,/package-lock\.json.*only authoritative dependency lockfile/);
 assert.match(agents,/npm run check/);
 assert.match(architecture,/history-signals/);
 assert.match(ingestion,/proportional across selected rarities/);
 assert.match(sources,/does not currently publish:[\s\S]*sales rank/i);
 assert.match(legacy,/not part of the maintained application/);
 assert.match(research,/LEGACY RESEARCH ONLY/);
 assert.match(ignore,/site-package\*\.tar\.gz/);
});

test("unused starter package-manager and D1 example artifacts are absent",async()=>{
 for(const path of ["pnpm-lock.yaml","pnpm-workspace.yaml","examples/d1/app/api/notes/route.ts","examples/d1/db/schema.ts"]){
  await assert.rejects(access(new URL(`../${path}`,import.meta.url)));
 }
});
