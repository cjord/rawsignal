export const utcGameDate=(now:number)=>new Date(now).toISOString().slice(0,10);
export function dailyGameSeed(game:string,date:string){let seed=2166136261;for(const char of `${game}:${date}`)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;return seed}
export function validGameDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value}
