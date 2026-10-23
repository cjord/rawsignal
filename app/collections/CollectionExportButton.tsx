"use client";
import {notify} from '../notifications/store';
import InfoHint from '../InfoHint';
export default function CollectionExportButton({label,filename,build,disabled}:{label:string;filename:string;build:()=>string;disabled:boolean}){
 const download=()=>{try{const url=URL.createObjectURL(new Blob([build()],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('CSV export prepared. It contains private collection and cost data.',{id:'collection-export',tone:'success'})}catch{notify('Unable to create the export. Your saved records are unchanged.',{id:'collection-export',tone:'warning'})}};
 return <span className="collection-export-control"><button className="game-control" disabled={disabled} onClick={download}>{label}</button><InfoHint label="What the CSV export includes">Exports all matching rows, not just this page. Includes private purchase costs and sticker prices where recorded. Missing values remain blank. Sold exports contain individual lot allocations for reconciliation.</InfoHint></span>;
}
