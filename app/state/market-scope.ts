// Resolve a landing once, before market-dependent defaults or requests are created.
// This is device-local navigation state, never an authenticated account document.
export function resolveMarketScope<T extends string>(requested:string|null,stored:string|null,allowed:readonly T[],fallback:T):T {
 return allowed.includes(requested as T)?requested as T:allowed.includes(stored as T)?stored as T:fallback;
}
