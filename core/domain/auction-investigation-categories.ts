export function investigationCategory(id:string):'Count'|'Locate'|'Value'{
 if(['lot-audit','rarities-v2','concentration','over5-mark','over20-mark'].includes(id))return 'Count';
 if(['bulk-v2','rares-v2','top2-final'].includes(id)||/^(reveal|rare\d|epic\d|alt\d|chase-scan|follow-up)/.test(id))return 'Value';
 return 'Locate';
}
export function investigationDisclosure(id:string){
 if(['lot-audit','over5-mark','over20-mark'].includes(id))return 'Counts + Rarity Marker';
 if(/identity/.test(id))return 'Identity · No Price';
 if(/mark|rarity|lot-audit/.test(id)&&!['over5-mark','over20-mark'].includes(id))return 'Rarity Only';
 return investigationCategory(id)==='Count'?'Counts / Distribution':'Prices / Valuation';
}
