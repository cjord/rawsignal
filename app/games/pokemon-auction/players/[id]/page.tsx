import AuctionCommunity from '../../../../AuctionCommunity';
export const metadata={title:'Pokémon Auction Profile | Raw Signal'};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AuctionCommunity mode="profile" id={id}/>}
