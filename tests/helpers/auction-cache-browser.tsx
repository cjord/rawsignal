import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import AccountProvider from '../../app/account/AccountProvider';
import RiftboundAuctionHouse from '../../app/RiftboundAuctionHouse';
import AuctionShowcase from '../../app/AuctionShowcase';
function Fixture(){const [showcase,setShowcase]=useState(false);return <><button onClick={()=>setShowcase(value=>!value)}>Switch Catalog Consumer</button>{showcase?<AuctionShowcase catalogCache/>:<RiftboundAuctionHouse catalogCache/>}</>}
createRoot(document.getElementById('fixture')!).render(<AccountProvider enabled><Fixture/></AccountProvider>);
