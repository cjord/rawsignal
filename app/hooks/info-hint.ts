export type InfoHintAlign="start"|"center"|"end";

// Tooltip max-width plus breathing room; alignment flips before the bubble would cross a
// viewport edge, mirroring disclosureSide in useDisclosurePopover.
export const INFO_HINT_WIDTH=250;

export function infoHintAlignment(centerX:number,viewportWidth:number,width=INFO_HINT_WIDTH):InfoHintAlign{
 const half=width/2;
 if(centerX<half)return "start";
 if(viewportWidth-centerX<half)return "end";
 return "center";
}
