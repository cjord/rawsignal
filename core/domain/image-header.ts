// Read only enough of a JPEG/PNG to distinguish artwork from known CDN placeholders.
export function imageHeaderSize(bytes:Uint8Array):{width:number;height:number}|null{
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return {width:view.getUint32(16),height:view.getUint32(20)};
 }
 if(bytes[0]!==255||bytes[1]!==216)return null;
 let offset=2;
 while(offset+3<bytes.length){
  if(bytes[offset++]!==255)return null;
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];
  if(marker===218||marker===217)return null;
  const length=bytes[offset]*256+bytes[offset+1];
  if(length<2||offset+length>bytes.length)return null;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)
   return {width:bytes[offset+5]*256+bytes[offset+6],height:bytes[offset+3]*256+bytes[offset+4]};
  offset+=length;
 }
 return null;
}
