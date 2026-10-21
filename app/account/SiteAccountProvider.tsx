"use client";
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import AccountProvider from './AccountProvider';
import {isPublicMarketPath} from './public-market-path';

// Route knowledge stays out of the storage/auth provider and its isolated tests.
export default function SiteAccountProvider({children,...props}:{enabled:boolean;collectionsEnabled?:boolean;children:ReactNode}) {
 const path=usePathname();
 return <AccountProvider {...props} publicMarket={isPublicMarketPath(path??'')}>{children}</AccountProvider>;
}
