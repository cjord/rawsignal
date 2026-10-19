export default function AuctionProfileSkeleton(){
 return <div className="auction-profile-pending" aria-busy="true"><p role="status">Loading Showcase…</p><div className="auction-profile-skeleton-stats" aria-hidden="true">{Array.from({length:8},(_,i)=><span key={i}/>)}</div><div className="auction-profile-skeleton-cards" aria-hidden="true">{Array.from({length:8},(_,i)=><span key={i}/>)}</div></div>;
}
