import {INVESTIGATIONS} from '../../core/domain/auction-information';

const tierTones={basic:'common',targeted:'rare',strong:'epic',premium:'premium'} as const;
const targetTones:Record<string,string>={common:'common',uncommon:'uncommon',rare:'rare',epic:'epic',alt:'epic',chase:'premium'};
const paths:Record<string,string>={
 count:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
 sets:'M5 7V3h14v14 M3 7h14v14H3z',
 rarities:'M12 3l9 9-9 9-9-9z M3 12h18 M12 3l-4 9 4 9 4-9z',
 duplicates:'M3 3h12v12H3z M9 15v6h12V9h-6',
 over5:'M12 3v18 M17 7c-1-3-10-3-10 1s10 3 10 7-9 4-10 1',
 over20:'M3 17l6-6 4 4 8-11 M15 4h6v6',
 reveal3:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
 identity3:'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3',
 identity10:'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3',
 bulk:'M3 9l9-6 9 6-9 6z M3 13l9 6 9-6 M3 17l9 6 9-6',
 highest:'M3 8l5 4 4-8 4 8 5-4-2 12H5z',
 rares:'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z',
 share:'M12 3v9h9 M9 3a9 9 0 1 0 12 12',
 top5:'M4 20v-5h4v5 M10 20V9h4v11 M16 20V3h4v17',
 appraisal:'M5 3h14v18H5z M8 7h8 M8 12h2 M14 12h2 M8 16h2 M14 16h2',
};
export default function AuctionClueIcon({id}:{id:string}){
 const tier=INVESTIGATIONS.find(option=>option.id===id)?.tier;
 const target=/^(common|uncommon|rare|epic|alt|chase)(?:\d|-)/.exec(id)?.[1];
 const tone=target?targetTones[target]:id==='rares'?'rare':tier?tierTones[tier]:undefined;
 let glyph=id;
 if(id==='rarity-peek3'||id.includes('-mark'))glyph='rarities';
 if(id.includes('-identity'))glyph='identity3';
 if(['common3','uncommon3','rare2','epic2','alt1','chase1'].includes(id))glyph=id==='chase1'?'highest':id==='common3'||id==='uncommon3'?'bulk':'rares';
 return <svg className="auction-clue-icon" data-clue={glyph} data-tone={tone} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[glyph==='public-start'?'reveal3':glyph==='legacy-inspection'?'identity3':glyph]??paths.appraisal}/></svg>;
}
