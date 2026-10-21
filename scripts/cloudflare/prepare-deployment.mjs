import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clone=value=>structuredClone(value);

export function prepareDeploymentConfig(base,{environment,databaseId,databaseName,workerName,route,cron,accounts=false,authBaseUrl,accountTools=false,accountCommunity=false,auctionCatalogCache=false,communityLimits,communityReadNamespace,accountWriteNamespace,communityModeration,sharedIdentity,identityDatabaseId}){
 if(environment!=="staging"&&environment!=="production")throw new Error("Environment must be staging or production");
 if(!uuid.test(databaseId??""))throw new Error("A valid Cloudflare D1 database UUID is required");
 if(!databaseName?.trim()||!workerName?.trim())throw new Error("Database and Worker names are required");
 if(environment==="production"&&!route?.trim())throw new Error("Production preparation requires an explicit custom-domain hostname");
 const config=clone(base),sourceDb=(config.d1_databases??[]).find(item=>item.binding==="DB")??{};
 config.name=workerName;config.topLevelName=workerName;
 config.workers_dev=environment==="staging";
 config.preview_urls=true;
 config.d1_databases=[{...sourceDb,binding:"DB",database_name:databaseName,database_id:databaseId,migrations_dir:"../../drizzle"}];
 // /data/* runs through the Worker so live-feed URLs can serve database rows; the handler
 // falls through to ASSETS.fetch for everything it does not intercept.
 config.assets={...(config.assets??{}),directory:"../client",binding:"ASSETS",run_worker_first:["/data/*"]};
 config.images={binding:"IMAGES"};
 config.version_metadata={binding:"CF_VERSION_METADATA"};
 config.vars={...(config.vars??{}),ENVIRONMENT:environment};
 configureAuctionCatalog(config,environment,auctionCatalogCache);
 configureAccounts(config,{accounts,authBaseUrl,accountTools,accountCommunity});
 configureIdentity(config,{accounts,sharedIdentity,identityDatabaseId,databaseId});
 configureCommunityProtection(config,{accounts,accountTools,accountCommunity,communityLimits,communityReadNamespace,accountWriteNamespace,communityModeration});
 if(environment==="production")config.vars.EBAY_DELETION_ENDPOINT_URL=`https://${route.trim()}/api/ebay/account-deletion`;
 else delete config.vars.EBAY_DELETION_ENDPOINT_URL;
 // A schedule exists only when explicitly requested (--cron / env) — never inherited from
 // the base config. Since the 2026-08-28 split, production is ingestion's home and carries
 // the guard cron; staging runs one only while deliberately testing ingestion changes.
 config.triggers={crons:cron?.trim()?[cron.trim()]:[]};
 config.observability={...(config.observability??{}),enabled:true};
 // Service binding to the standalone Browser Rendering worker that walks the full Collectr
 // showcase API (workers/collectr-fetch). A binding — not a public workers.dev fetch — is
 // required: a Worker's subrequest to another same-account workers.dev host 404s. One
 // shared collectr worker serves both environments.
 config.services=[{binding:"COLLECTR_FETCH",service:"raw-signal-collectr"}];
 if(environment==="production")config.routes=[{pattern:route.trim(),custom_domain:true}];else delete config.routes;
 return config;
}

function configureIdentity(config,{accounts,sharedIdentity,identityDatabaseId,databaseId}){
 config.vars.AUTH_SHARED_IDENTITY_ENABLED='false';
 if(!sharedIdentity)return;
 if(!accounts||!uuid.test(identityDatabaseId??'')||identityDatabaseId===databaseId)throw new Error('Shared identity requires accounts and a distinct identity-only D1 database');
 config.vars.AUTH_SHARED_IDENTITY_ENABLED='true';
 config.d1_databases.push({binding:'IDENTITY_DB',database_name:'raw-signal-identity',database_id:identityDatabaseId,migrations_dir:'../../drizzle/identity'});
}

function configureAuctionCatalog(config,environment,enabled){
 if(enabled&&environment!=='staging')throw new Error('Auction catalog cache is staging-only during rollout');
 config.vars.AUCTION_CATALOG_CACHE_ENABLED=enabled?'true':'false';
}
function configureCommunityProtection(config,{accounts,accountTools,accountCommunity,communityLimits,communityReadNamespace,accountWriteNamespace,communityModeration}){
 config.vars.AUTH_COMMUNITY_LIMITS_ENABLED='false';config.vars.AUTH_COMMUNITY_MODERATION_ENABLED='false';
 config.ratelimits=(config.ratelimits??[]).filter(binding=>!['COMMUNITY_READ_LIMITER','ACCOUNT_WRITE_LIMITER'].includes(binding.name));
 if(!config.ratelimits.length)delete config.ratelimits;
 if((communityLimits||communityModeration)&&(!accounts||!accountCommunity||!accountTools))throw new Error('Community protection requires accounts, tools and community');
 if(communityModeration)config.vars.AUTH_COMMUNITY_MODERATION_ENABLED='true';
 if(!communityLimits)return;
 if(![communityReadNamespace,accountWriteNamespace].every(value=>typeof value==='string'&&/^[1-9][0-9]{0,15}$/.test(value))||communityReadNamespace===accountWriteNamespace)throw new Error('Choose distinct rate-limit namespace integers; keep staging and production separate');
 config.vars.AUTH_COMMUNITY_LIMITS_ENABLED='true';
 config.ratelimits=[...(config.ratelimits??[]),{name:'COMMUNITY_READ_LIMITER',namespace_id:communityReadNamespace,simple:{limit:120,period:60}},{name:'ACCOUNT_WRITE_LIMITER',namespace_id:accountWriteNamespace,simple:{limit:60,period:60}}];
}

function configureAccounts(config,{accounts,authBaseUrl,accountTools,accountCommunity}){
 // Never inherit an account-enabled build or email binding into another release.
 config.vars.AUTH_ENABLED='false';delete config.vars.AUTH_BASE_URL;
 config.vars.AUTH_AUDIT_ENABLED='false';config.vars.AUTH_RECOVERY_ENABLED='false';
 config.vars.AUTH_COMMUNITY_ENABLED='false';
 if(accountCommunity&&(!accounts||!accountTools))throw new Error('Community requires accounts, account tools and applied profile migration');
 if(accountTools&&!accounts)throw new Error('Account tools require accounts and the applied recovery/audit migration');
 config.send_email=(config.send_email??[]).filter(binding=>binding.name!=='AUTH_EMAIL');
 if(!config.send_email.length)delete config.send_email;
 if(!accounts)return;
 let origin;try{origin=new URL(authBaseUrl)}catch{throw new Error('Account deployments require an explicit HTTPS auth origin')}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('Account deployments require an explicit HTTPS auth origin');
 config.vars.AUTH_ENABLED='true';config.vars.AUTH_BASE_URL=origin.origin;
 if(accountTools){config.vars.AUTH_AUDIT_ENABLED='true';config.vars.AUTH_RECOVERY_ENABLED='true'}
 if(accountCommunity)config.vars.AUTH_COMMUNITY_ENABLED='true';
 config.send_email=[...(config.send_email??[]),{name:'AUTH_EMAIL',allowed_sender_addresses:['accounts@rawsignal.cards']}];
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
  cron:option("cron")??process.env.RAW_SIGNAL_STAGING_CRON,
  accounts:option('accounts')==='true',authBaseUrl:option('auth-base-url'),accountTools:option('account-tools')==='true',accountCommunity:option('account-community')==='true',auctionCatalogCache:option('auction-catalog-cache')==='true',
  communityLimits:option('community-limits')==='true',communityReadNamespace:option('community-read-namespace'),accountWriteNamespace:option('account-write-namespace'),communityModeration:option('community-moderation')==='true',
  sharedIdentity:option('shared-identity')==='true',identityDatabaseId:option('identity-database-id')??process.env.RAW_SIGNAL_IDENTITY_D1_DATABASE_ID,
 });
 await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,`${JSON.stringify(config,null,2)}\n`);
 console.log(outPath);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
