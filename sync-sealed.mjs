import fs from "node:fs/promises";

const BASE="https://tcgcsv.com/tcgplayer";
const headers={"User-Agent":"RawSignal/4.0 (+sealed market tracker)"};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function json(url){for(let attempt=0;attempt<3;attempt++){const response=await fetch(url,{headers});if(response.ok){const body=await response.json();await wait(90);return body.results??body}await wait(500*(attempt+1))}throw new Error(`Failed ${url}`)}
const highestPrice=prices=>{const priced=prices.filter(row=>Number(row.marketPrice)>0);return priced.sort((a,b)=>b.marketPrice-a.marketPrice)[0]};
const sealedName=name=>/(booster|bundle|box|display|collection|deck|tin|kit|vault|starter)/i.test(name)&&!/(single card|code card)/i.test(name);
const category=name=>/booster (box|display)/i.test(name)?"Booster boxes":/booster/i.test(name)?"Boosters":/bundle/i.test(name)?"Bundles":/deck/i.test(name)?"Decks":/tin/i.test(name)?"Tins":/collection/i.test(name)?"Collections":"Other";
const card=(game,product,set,msrp,price,source)=>({game,productId:product.productId??product.id,name:product.name,set,category:category(product.name),image:(product.imageUrl??product.image)?.replace("_200w","_in_1000x1000"),url:product.url,msrp,marketPrice:Number(price.marketPrice??price.market),midPrice:Number(price.midPrice??price.median)||null,profit:Number((Number(price.marketPrice??price.market)-msrp).toFixed(2)),profitPct:Number((((Number(price.marketPrice??price.market)-msrp)/msrp)*100).toFixed(1)),msrpSource:source});

const pokemonRaw=await fetch("https://tcg-price-tracker.shizukaziye.workers.dev/data/data.json",{headers}).then(response=>response.json());
const pokemon=pokemonRaw.items.filter(item=>item.matched&&item.msrp>0&&item.market>0).map(item=>card("pokemon",item,item.set,item.msrp,{market:item.market,median:item.median},"Published product MSRP")).sort((a,b)=>b.profitPct-a.profitPct);

function riftMsrp(name){if(/case|set of|art bundle/i.test(name))return null;if(/booster (display|box)/i.test(name))return 120;if(/booster pack/i.test(name))return 4.99;if(/proving grounds/i.test(name))return 29.99;if(/champion deck.*display|display.*champion deck/i.test(name))return 79.96;if(/champion deck/i.test(name))return 19.99;if(/unleashed vault/i.test(name))return 34.99;if(/arcane box set/i.test(name))return 40;return null}
function magicMsrp(group,name){if(/display|case|booster box|set of|sample pack|omega pack/i.test(name))return null;if(/foundations/i.test(group)){if(/collector booster/i.test(name))return 24.99;if(/jumpstart booster/i.test(name))return 5.49;if(/play booster|booster pack/i.test(name))return 5.25;if(/starter collection/i.test(name))return 59.99;if(/beginner box/i.test(name))return 29.99;if(/bundle/i.test(name))return 49.99}if(/innistrad remastered/i.test(group)){if(/collector booster/i.test(name))return 29.99;if(/play booster|booster pack/i.test(name))return 6.99}if(/aetherdrift/i.test(group)){if(/collector booster/i.test(name))return 24.99;if(/play booster|booster pack/i.test(name))return 5.49;if(/commander deck/i.test(name))return 44.99;if(/finish line|specialty bundle/i.test(name))return 79.99;if(/bundle/i.test(name))return 53.99}return null}

async function collect(categoryId,game,msrpFor,groupFilter=()=>true){const groups=(await json(`${BASE}/${categoryId}/groups`)).filter(groupFilter),items=[];for(const [index,group] of groups.entries()){const [products,prices]=await Promise.all([json(`${BASE}/${categoryId}/${group.groupId}/products`),json(`${BASE}/${categoryId}/${group.groupId}/prices`)]);const byProduct=new Map();for(const row of prices)(byProduct.get(row.productId)??byProduct.set(row.productId,[]).get(row.productId)).push(row);for(const product of products){if(!sealedName(product.name))continue;const msrp=msrpFor(product.name,group.name),price=highestPrice(byProduct.get(product.productId)??[]);if(msrp&&price)items.push(card(game,product,group.name,msrp,price,game==="riftbound"?"Asmodee/Riftbound MSRP":"Wizards published MSRP"))}if(index%20===0)console.error(`${game}: ${index+1}/${groups.length}`)}return items.sort((a,b)=>b.profitPct-a.profitPct)}

const riftbound=await collect(89,"riftbound",riftMsrp);
const magic=await collect(1,"magic",(name,group)=>magicMsrp(group,name),group=>/Foundations|Innistrad Remastered|Aetherdrift/i.test(group.name));
await fs.mkdir("public/data",{recursive:true});
await Promise.all(Object.entries({pokemon,riftbound,magic}).map(([game,items])=>fs.writeFile(`public/data/sealed-${game}.json`,JSON.stringify(items))));
console.log({pokemon:pokemon.length,riftbound:riftbound.length,magic:magic.length});
