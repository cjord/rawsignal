import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import AccountProvider from '../../app/account/AccountProvider';
import RiftboundAuctionHouse from '../../app/RiftboundAuctionHouse';
import AuctionShowcase from '../../app/AuctionShowcase';
import AuctionInventory from '../../app/AuctionInventory';
import {auctionCatalogCache} from '../../app/data/auction-catalog-cache';
function Fixture(){const [showcase,setShowcase]=useState(false);if(new URLSearchParams(location.search).get('view')==='inventory')return <AuctionInventory catalogCache/>;return <><button onClick={()=>setShowcase(value=>!value)}>Switch Catalog Consumer</button><button onClick={()=>void auctionCatalogCache.refresh(true)}>Check Catalog (Test)</button>{showcase?<AuctionShowcase catalogCache/>:<RiftboundAuctionHouse catalogCache/>}</>}
createRoot(document.getElementById('fixture')!).render(<AccountProvider enabled><Fixture/></AccountProvider>);
