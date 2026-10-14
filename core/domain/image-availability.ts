const TCGPLAYER_CDN=/^https:\/\/tcgplayer-cdn\.tcgplayer\.com\//;
export const isTcgplayerPlaceholder=(image:{currentSrc?:string;src:string;naturalWidth:number;naturalHeight:number})=>TCGPLAYER_CDN.test(image.currentSrc||image.src)&&((image.naturalWidth===400&&image.naturalHeight===570)||(image.naturalWidth===200&&image.naturalHeight===285));
