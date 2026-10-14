import type { Card } from "./types.ts";

// Regular-rarity TCGCSV identities verified against the bundled Riftbound catalog.
// Names AND collector numbers disambiguate new cards and different promo artwork.
// The four /024 entries use the regular Proving Grounds Starter printing.
const regularPrintings: readonly [string, string, number][] = [
  ["Kai'Sa, Daughter of the Void", "247/298", 653045],
  ["Volibear, Relentless Storm", "249/298", 653047],
  ["Jinx, Loose Cannon", "251/298", 653049],
  ["Darius, Hand of Noxus", "253/298", 653051],
  ["Ahri, Nine-Tailed Fox", "255/298", 653053],
  ["Lee Sin, Blind Monk", "257/298", 653055],
  ["Yasuo, Unforgiven", "259/298", 653057],
  ["Leona, Radiant Dawn", "261/298", 653059],
  ["Teemo, Swift Scout", "263/298", 653061],
  ["Viktor, Herald of the Arcane", "265/298", 653063],
  ["Miss Fortune, Bounty Hunter", "267/298", 653065],
  ["Sett, The Boss", "269/298", 653067],
  ["Annie, Dark Child", "017/024", 653152],
  ["Master Yi, Wuju Bladesman", "019/024", 653154],
  ["Lux, Lady of Luminosity", "021/024", 653156],
  ["Garen, Might of Demacia", "023/024", 653158],
  ["Rumble, Mechanized Menace", "181/221", 664915],
  ["Lucian, Purifier", "183/221", 664920],
  ["Draven, Glorious Executioner", "185/221", 663442],
  ["Rek'sai, Void Burrower", "187/221", 664922],
  ["Ornn, Fire Below the Mountain", "189/221", 664924],
  ["Jax, Grandmaster At Arms", "193/221", 664925],
  ["Irelia, Blade Dancer", "195/221", 663441],
  ["Azir, Emperor of the Sands", "197/221", 663440],
  ["Ezreal, Prodigal Explorer", "199/221", 664927],
  ["Renata Glasc, Chem-Baroness", "201/221", 663439],
  ["Sivir, Battle Mistress", "203/221", 663438],
  ["Fiora, Grand Duelist", "205/221", 664928],
  ["Jhin, Virtuoso", "181/219", 684500],
  ["Rengar, Pridestalker", "183/219", 684618],
  ["Pyke, Bloodharbor Ripper", "185/219", 684619],
  ["Vi, Piltover Enforcer", "187/219", 684475],
  ["Lillia, Bashful Bloom", "189/219", 684102],
  ["Master Yi, Wuju Master", "191/219", 684620],
  ["Vex, Gloomist", "193/219", 684214],
  ["Ivern, Green Father", "195/219", 684115],
  ["Diana, Scorn of the Moon", "197/219", 684103],
  ["LeBlanc, Deceiver", "199/219", 684208],
  ["Kha'Zix, Voidreaver", "201/219", 684104],
  ["Poppy, Keeper of the Hammer", "203/219", 684523],
];

const nameKey = (name: string) => name.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const identityKey = (name: string, number: string) => `${nameKey(name)}|${number.replace(/\s+/g, "").toLowerCase()}`;
const regularByIdentity = new Map(regularPrintings.map(([name, number, productId]) => [identityKey(name, number), productId]));

export function riftboundRegularArtworkImage(card: { game: string; name: string; number?: string | null }): string | null {
  if (card.game !== "riftbound" || !card.number || !/\((?:Metal|Best Of)\)/i.test(card.name)) return null;
  const name = card.name.replace(/(?:\s*\((?:Metal|Best Of|Prize Wall)\))+\s*$/i, "");
  const productId = regularByIdentity.get(identityKey(name, card.number));
  return productId ? `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_in_1000x1000.jpg` : null;
}

/** Presentation-only artwork substitution; identity, treatment and prices stay attached to the promo. */
export function withRiftboundRegularArtwork<T extends Pick<Card, "game" | "name" | "number" | "image">>(card: T): T {
  const image = riftboundRegularArtworkImage(card);
  return !image || image === card.image ? card : { ...card, image };
}
