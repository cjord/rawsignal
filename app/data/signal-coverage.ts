export const SIGNAL_FALLBACK_LIMIT=400;

type Indexed<T>={item:T;index:number};
type Group<T>={key:string;items:Indexed<T>[];quota:number;remainder:number};

const spacedIndices=(length:number,count:number)=>{
 if(count>=length)return Array.from({length},(_,index)=>index);
 if(count<=1)return[Math.floor((length-1)/2)];
 return Array.from({length:count},(_,index)=>Math.round(index*(length-1)/(count-1)));
};

/**
 * Selects a bounded fallback set without favoring the first source file or only
 * the highest-priced records. Quotas are proportional by group and samples are
 * evenly spaced through each group's existing order.
 */
export function selectSignalCandidates<T>(items:T[],limit=SIGNAL_FALLBACK_LIMIT,groupKey:(item:T)=>string=()=>"all"):T[]{
 if(limit<=0||!items.length)return[];
 if(items.length<=limit)return items;
 const grouped=new Map<string,Indexed<T>[]>();
 items.forEach((item,index)=>{const key=groupKey(item),group=grouped.get(key)??[];group.push({item,index});grouped.set(key,group)});
 const groups:Group<T>[]=[...grouped].map(([key,groupItems])=>{const exact=limit*groupItems.length/items.length;return{key,items:groupItems,quota:Math.floor(exact),remainder:exact-Math.floor(exact)}});

 if(groups.length<=limit)for(const group of groups)if(group.quota===0)group.quota=1;
 let assigned=groups.reduce((sum,group)=>sum+group.quota,0);
 const addOrder=[...groups].sort((a,b)=>b.remainder-a.remainder||a.key.localeCompare(b.key));
 while(assigned<limit){
  const target=addOrder.find(group=>group.quota<group.items.length);
  if(!target)break;
  target.quota++;assigned++;
  addOrder.push(addOrder.shift()!);
 }
 const removeOrder=[...groups].sort((a,b)=>a.remainder-b.remainder||b.key.localeCompare(a.key));
 while(assigned>limit){
  const target=removeOrder.find(group=>group.quota>1);
  if(!target)break;
  target.quota--;assigned--;
  removeOrder.push(removeOrder.shift()!);
 }

 return groups.flatMap(group=>spacedIndices(group.items.length,group.quota).map(index=>group.items[index])).sort((a,b)=>a.index-b.index).map(entry=>entry.item);
}
