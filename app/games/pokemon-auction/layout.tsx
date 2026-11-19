import type {ReactNode} from 'react';
import AuctionShell from '../AuctionShell';
import {AuctionGameProvider} from '../AuctionGameContext';
export default function PokemonAuctionLayout({children}:{children:ReactNode}){return <AuctionGameProvider market="pokemon"><AuctionShell>{children}</AuctionShell></AuctionGameProvider>}
