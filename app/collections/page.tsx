import CollectionsView from './CollectionsView';
export const metadata={title:'Collections — Raw Signal',robots:{index:false,follow:false}};
export default async function CollectionsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const values=await searchParams,query=new URLSearchParams();for(const [key,value] of Object.entries(values))if(typeof value==='string')query.set(key,value);return <CollectionsView initialQuery={query.toString()}/>}
