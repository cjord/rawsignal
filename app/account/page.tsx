import AccountView from './AccountView';
export const metadata={title:'Account — Raw Signal',robots:{index:false,follow:false}};
export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const query=await searchParams;return <AccountView authError={typeof query.error==='string'?query.error:undefined} emailFirst={query.method==='email'} linkHint={query.link==='1'}/>}
