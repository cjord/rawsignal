"use client";

// One stable footer for inventory, backdrop editing and cursor-based directories.
export default function AuctionPagination({label,page,pages,previous,next,canPrevious,canNext,disabled=false,previousLabel='Previous Page',nextLabel='Next Page'}:{label:string;page:number;pages?:number;previous:()=>void;next:()=>void;canPrevious:boolean;canNext:boolean;disabled?:boolean;previousLabel?:string;nextLabel?:string}){
 return <nav className="auction-pagination" aria-label={label}><button className="game-control" type="button" aria-label={previousLabel} disabled={disabled||!canPrevious} onClick={previous}>← Previous</button><span role="status">Page {page}{pages===undefined?'':` of ${pages}`}</span><button className="game-control" type="button" aria-label={nextLabel} disabled={disabled||!canNext} onClick={next}>Next →</button></nav>;
}
