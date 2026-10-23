export const privateAccountHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export const accountJson=(body:unknown,status=200)=>Response.json(body,{status,headers:privateAccountHeaders});
export function privateAccountResponse(response:Response){const headers=new Headers(response.headers);for(const [key,value] of Object.entries(privateAccountHeaders))headers.set(key,value);return new Response(response.body,{status:response.status,headers})}
