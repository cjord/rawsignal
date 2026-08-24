import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const sans=Geist({variable:"--font-sans",subsets:["latin"]}); const mono=Geist_Mono({variable:"--font-mono",subsets:["latin"]});
export const metadata: Metadata={title:"Raw Signal — Pokémon & Riftbound Rankings",description:"Daily Pokémon and Riftbound card price leaderboards built from TCGCSV market data."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>}
