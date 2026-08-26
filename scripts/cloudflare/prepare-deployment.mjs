import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clone=value=>structuredClone(value);

export function prepareDeploymentConfig(base,{environment,databaseId,databaseName,workerName,route}){
 if(environment!=="staging"&&environment!=="production")throw new Error("Environment must be staging or production");
 if(!uuid.test(databaseId??""))throw new Error("A valid Cloudflare D1 database UUID is required");
 if(!databaseName?.trim()||!workerName?.trim())throw new Error("Database and Worker names are required");
 if(environment==="production"&&!route?.trim())throw new Error("Production preparation requires an explicit custom-domain hostname");
 const config=clone(base),sourceDb=(config.d1_databases??[]).find(item=>item.binding==="DB")??{};
 config.name=workerName;config.topLevelName=workerName;
 config.workers_dev=environment==="staging";
 config.preview_urls=true;
 config.d1_databases=[{...sourceDb,binding:"DB",database_name:databaseName,database_id:databaseId,migrations_dir:"../../drizzle"}];
 config.assets={...(config.assets??{}),directory:"../client",binding:"ASSETS"};
 config.images={binding:"IMAGES"};
 config.version_metadata={binding:"CF_VERSION_METADATA"};
 config.vars={...(config.vars??{}),ENVIRONMENT:environment};
 config.triggers={};
 config.observability={...(config.observability??{}),enabled:true};
 if(environment==="production")config.routes=[{pattern:route.trim(),custom_domain:true}];else delete config.routes;
 return config;
}

const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(`--${name}`);return index>=0?args[index+1]:undefined};

async function main(){
 const environment=option("environment"),root=process.cwd();
 const manifest=JSON.parse(await fs.readFile(path.join(root,"cloudflare/environments.json"),"utf8"));
 const defaults=manifest.environments?.[environment];if(!defaults)throw new Error("Use --environment staging or --environment production");
 const basePath=path.resolve(root,option("base")??"dist/server/wrangler.json");
 const outPath=path.resolve(root,option("out")??`dist/server/wrangler.${environment}.json`);
 const databaseId=option("database-id")??process.env.RAW_SIGNAL_D1_DATABASE_ID;
 const config=prepareDeploymentConfig(JSON.parse(await fs.readFile(basePath,"utf8")),{
  environment,databaseId,databaseName:option("database-name")??defaults.databaseName,
  workerName:option("worker-name")??defaults.workerName,route:option("route"),
 });
 await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,`${JSON.stringify(config,null,2)}\n`);
 console.log(outPath);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
