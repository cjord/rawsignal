import type {D1DatabaseLike} from './repository.ts';
type Meta={rows_read?:number;rows_written?:number;duration?:number};
// Instrument existing reads only. Never log SQL, bound values, returned records,
// database identifiers or owner information. Missing platform metadata is unknown.
export function meteredReads(database:D1DatabaseLike){
 let statements=0,rowsRead=0,rowsWritten=0,sqlMs=0,complete=true;
 const wrap=(statement:ReturnType<D1DatabaseLike['prepare']>):ReturnType<D1DatabaseLike['prepare']>=>{
  const all=async<T>()=>{
   statements++;
   let result:{results?:T[];meta?:Meta};try{result=await statement.all<T>()}catch(cause){complete=false;throw cause}const meta=result.meta;
   if(!meta||![meta.rows_read,meta.rows_written,meta.duration].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0))complete=false;
   else{rowsRead+=meta.rows_read!;rowsWritten+=meta.rows_written!;sqlMs+=meta.duration!}
   return result;
  };
  return {bind:(...values)=>wrap(statement.bind(...values)),all,first:async<T>()=>(await all<T>()).results?.[0]??null,run:()=>Promise.reject(new Error('Read measurement does not permit writes'))};
 };
 const db:D1DatabaseLike={prepare:sql=>wrap(database.prepare(sql)),batch:()=>Promise.reject(new Error('Read measurement does not permit batches'))};
 return {db,summary:()=>({statements,rowsRead:complete?rowsRead:null,rowsWritten:complete?rowsWritten:null,sqlMs:complete?sqlMs:null})};
}
