// Only these read-only market surfaces opt out of the account-owner remount.
// Games, collections, imports, buy lists and account/admin routes stay isolated.
export const isPublicMarketPath=(path:string)=>path==='/'||path==='/sets'||path==='/metrics'||/^\/sets\/[^/]+\/[^/]+\/?$/.test(path)||/^\/(cards|sealed)\/\d+\/?$/.test(path);
