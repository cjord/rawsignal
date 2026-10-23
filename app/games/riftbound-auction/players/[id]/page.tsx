import AuctionCommunity from '../../../../AuctionCommunity';
export const metadata={title:'Auction Profile | Raw Signal',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AuctionCommunity mode="profile" id={id}/>}
