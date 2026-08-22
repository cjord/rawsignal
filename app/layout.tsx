import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const sans=Geist({variable:"--font-sans",subsets:["latin"]}); const mono=Geist_Mono({variable:"--font-mono",subsets:["latin"]});
export const metadata: Metadata={title:"Raw Signal — Pokémon Card Market Watch",description:"50 raw modern and mid-era Pokémon cards trading below their recent highs, researched with PriceCharting and TCGplayer."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>}
