// Read-only markets and the static Games directory retain their mounted content.
// Actual games, collections, imports, buy lists and account/admin stay owner-isolated.
export const isPublicMarketPath=(path:string)=>path==='/'||path==='/games'||path==='/sets'||path==='/metrics'||/^\/sets\/[^/]+\/[^/]+\/?$/.test(path)||/^\/(cards|sealed)\/\d+\/?$/.test(path);
