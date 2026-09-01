import Link from "next/link";

// Condensed site-wide footer (todo N3): the main page keeps its full footer; every
// other surface renders this compact variant — same dark band, one provenance line,
// and the primary navigation links. Pure markup, safe in server and client trees.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand" href="/">
        <span>R</span> Raw Signal
      </Link>
      <div>
        <p>
          Cached TCGplayer catalog and pricing via{" "}
          <a href="https://tcgcsv.com/docs" target="_blank" rel="noreferrer">
            TCGCSV
          </a>
          . Unavailable data displays as unavailable — never estimated.
        </p>
        <nav className="site-footer-links" aria-label="Site">
          <Link href="/">Rankings</Link>
          <Link href="/sets">Sets</Link>
          <Link href="/metrics">Metrics</Link>
          <Link href="/buylist">Buy List</Link>
          <Link href="/import">Import</Link>
          <Link href="/#method">Methodology</Link>
        </nav>
      </div>
    </footer>
  );
}
