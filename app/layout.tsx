import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./styles/tokens.css";
import "./globals.css";
import "./market-views.css";
import "./styles/market-controls.css";
import "./styles/market-content.css";
import "./detail.css";
const sans=Geist({variable:"--font-sans",subsets:["latin"]}); const mono=Geist_Mono({variable:"--font-mono",subsets:["latin"]});
export const metadata: Metadata={title:"Raw Signal — TCG Market Rankings",description:"Daily Pokémon, Riftbound, and One Piece singles and sealed-product price intelligence built from TCGCSV market data."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" data-theme="dark" data-font-size="default" suppressHydrationWarning><head><meta name="color-scheme" content="dark light"/><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem("raw-signal-theme")==="light"?"light":"dark";document.documentElement.dataset.fontSize=localStorage.getItem("raw-signal-font-size")==="large"?"large":"default"}catch{}`}}/></head><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>}
