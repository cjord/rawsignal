import type { Metadata } from "next";
// Fonts are self-hosted via app/styles/fonts.css — never next/font/google: the vinext loader
// bakes absolute local cache paths into production builds (deployed sites then render the
// Arial-based metric fallbacks instead of Geist).
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./globals.css";
import "./market-views.css";
import "./styles/market-controls.css";
import "./styles/market-content.css";
import "./detail.css";
import "./metrics.css";
export const metadata: Metadata={title:"Raw Signal — TCG Market Rankings",description:"Daily Pokémon, Riftbound, and One Piece singles and sealed-product price intelligence built from TCGCSV market data."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" data-theme="dark" data-font-size="default" suppressHydrationWarning><head><meta name="color-scheme" content="dark light"/><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem("raw-signal-theme")==="light"?"light":"dark";document.documentElement.dataset.fontSize=localStorage.getItem("raw-signal-font-size")==="large"?"large":"default"}catch{}`}}/></head><body>{children}</body></html>}
