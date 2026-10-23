export async function boundedJson(request:Request,limit=1600000){
 const reader=request.body?.getReader();if(!reader)throw new Error('Empty body');let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new Error('Body too large')}chunks.push(value)}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
