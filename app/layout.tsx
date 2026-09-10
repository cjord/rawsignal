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
import "./buylist.css";
import "./sets.css";
import "./collectr.css";
import {EBAY_EPN_CAMPAIGN_ID,EBAY_SMART_LINKS_SRC} from "../core/domain/marketplace-links";
export const metadata: Metadata={title:"Raw Signal — TCG Market Rankings",description:"Daily Pokémon, Riftbound, and One Piece singles and sealed-product price intelligence built from TCGCSV market data."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" data-theme="dark" data-font-size="default" suppressHydrationWarning><head><meta name="color-scheme" content="dark light"/>{/* Impact (TCGplayer affiliate) site verification, added 2026-09-04. Impact's tag uses a `value` attribute, which the meta typings lack, hence the spread; `content` carries the same token for checkers that read the standard attribute. */}<meta name="impact-site-verification" {...{value:"9b189944-e855-40a0-a9f2-e3913ff532e5"}} content="9b189944-e855-40a0-a9f2-e3913ff532e5"/>{/* eBay Partner Network Smart Links (todo O1, 2026-09-09): rewrites ebay.com links on the page to the campaign at click time. The popover variant (`smartPopover:true`) would put a promotional card over the inspection surfaces on phones, so it stays off; the config must precede the deferred script. */}<script dangerouslySetInnerHTML={{__html:`window._epn={campaign:${EBAY_EPN_CAMPAIGN_ID},smartPopover:false};`}}/><script src={EBAY_SMART_LINKS_SRC} defer/><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem("raw-signal-theme")==="light"?"light":"dark";document.documentElement.dataset.fontSize=localStorage.getItem("raw-signal-font-size")==="large"?"large":"default"}catch{}`}}/></head><body>{children}</body></html>}
