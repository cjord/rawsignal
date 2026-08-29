import type { Metadata } from "next";
import CollectrImportView from "../CollectrImportView";

export const metadata: Metadata = {
  title: "Collectr Import — Raw Signal",
  description: "Import a public Collectr showcase, match every raw single to tracked market data, and see which cards the signals say to hold or sell.",
};

export default function CollectrImportRoute() {
  return <CollectrImportView />;
}
