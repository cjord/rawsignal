import Link from "next/link";
import SiteFooter from "./SiteFooter";

export default function NotFound() {
  return (
    <>
      <main className="detail-page">
        <section className="detail-not-found">
          <span className="kicker">Market record unavailable</span>
          <h1>We couldn’t find that product.</h1>
          <p>The catalog may have refreshed or the link may be incomplete.</p>
          <Link href="/">Return to Raw Signal</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
