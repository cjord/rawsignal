export const JSON_REQUEST_TIMEOUT_MS=15_000;
export class JsonRequestTimeout extends Error{
 constructor(){super('The request timed out. Your last saved data has not been replaced.');this.name='JsonRequestTimeout'}
}
// The deadline includes reading the body. Caller cancellation is optional; shared
// catalog loads intentionally do not use any individual subscriber's signal.
export async function requestJson(input:RequestInfo|URL,init:RequestInit={},options:{timeoutMs?:number;fetcher?:typeof fetch}={}){
 const controller=new AbortController(),timeout=options.timeoutMs??JSON_REQUEST_TIMEOUT_MS,fetcher=options.fetcher??fetch;
 if(!Number.isFinite(timeout)||timeout<=0)throw new Error('Invalid request deadline');
 let timer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>controller.abort(init.signal?.reason);
 if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
 const work=(async()=>{const response=await fetcher(input,{...init,signal:controller.signal});let data:unknown;try{data=await response.json()}catch(cause){if(response.ok)throw cause;data=null}return {response,data}})();
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new JsonRequestTimeout());controller.abort()},timeout)});
 try{return await Promise.race([work,deadline])}finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort)}
}
