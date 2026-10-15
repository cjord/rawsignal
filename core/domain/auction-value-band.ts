const money=(cents:number)=>`$${(cents/100).toFixed(2)}`;
// Fixed brackets, not a range centered on the hidden total. Prices are frozen cents.
export function auctionValueBand(value:number){
 const upper=[5000,10000,25000,50000,100000,200000];
 const index=upper.findIndex((limit,index)=>value<limit||index===upper.length-1&&value===limit);
 if(index<0)return `${money(200000)}+ total market value (before fees).`;
 const low=index===0?0:upper[index-1],high=upper[index];
 return `${money(low)}–${index===upper.length-1?'':'under '}${money(high)} total market value (before fees).`;
}
