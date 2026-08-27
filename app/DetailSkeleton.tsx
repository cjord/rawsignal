/* eslint-disable @next/next/no-html-link-for-pages -- detail navigation preserves exact leaderboard URLs */
export default function DetailSkeleton(){
 return <main className="detail-page" aria-busy="true" aria-label="Loading product details">
  <nav className="topbar detail-topbar"><a className="brand" href="/"><span>R</span> Raw Signal</a><div className="detail-nav-actions"><span className="skeleton skeleton-pill"/><span className="skeleton skeleton-pill skeleton-pill-short"/></div></nav>
  <div className="detail-content detail-skeleton">
   <span className="skeleton skeleton-line skeleton-breadcrumb"/>
   <section className="detail-hero">
    <div className="detail-art"><span className="skeleton skeleton-art"/></div>
    <div className="detail-overview">
     <span className="skeleton skeleton-line skeleton-kicker"/>
     <span className="skeleton skeleton-line skeleton-title"/>
     <span className="skeleton skeleton-line skeleton-subtitle"/>
     <span className="skeleton skeleton-price"/>
     <div className="skeleton-grid">{Array.from({length:6},(_,index)=><span className="skeleton skeleton-metric" key={index}/>)}</div>
    </div>
   </section>
   <section className="detail-section">
    <span className="skeleton skeleton-line skeleton-kicker"/>
    <span className="skeleton skeleton-chart"/>
    <div className="skeleton-grid">{Array.from({length:8},(_,index)=><span className="skeleton skeleton-metric" key={index}/>)}</div>
   </section>
  </div>
 </main>;
}
