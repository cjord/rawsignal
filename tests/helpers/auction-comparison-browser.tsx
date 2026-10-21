import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useAuctionCatalog} from '../../app/data/useAuctionCatalog';
const snapshot=new URLSearchParams(location.search).get('snapshot')==='1';
function Consumer(){const state=useAuctionCatalog(true,snapshot);return <><output aria-label="Catalog State">{state.status}</output><output aria-label="Catalog Rows">{JSON.stringify(state.items.map(card=>[card.productId,card.printing,card.marketPrice,card.image]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))}</output><button onClick={state.reload}>Refresh Catalog</button></>}
function Fixture(){const [key,setKey]=useState(0);return <><button onClick={()=>setKey(value=>value+1)}>Remount Consumer</button><Consumer key={key}/></>}
createRoot(document.getElementById('fixture')!).render(<Fixture/>);
