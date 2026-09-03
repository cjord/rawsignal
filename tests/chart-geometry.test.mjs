import assert from "node:assert/strict";
import test from "node:test";
import {chartGeometry} from "../app/chart-geometry.ts";

// The pure geometry PriceChart memoizes (refactor 2026-09, wave 5). Pins the contract the
// SVG relies on: the 240×76 viewBox mapping, range slicing, extreme markers, overlays,
// volumes, and the detail-only trailing mean.
const series=(prices,start=1)=>prices.map((price,index)=>({date:new Date(Date.UTC(2026,0,start+index)).toISOString().slice(0,10),price}));

test("maps the selected range onto the 240×76 plot with the extremes marked",()=>{
 const points=series([10,12,8,14,11],1);
 const geometry=chartGeometry(points,30,undefined,undefined,false);
 assert.equal(geometry.chartPoints.length,5);
 assert.equal(geometry.xy[0].x,0);
 assert.equal(geometry.xy.at(-1).x,240);
 assert.equal(geometry.min,8);assert.equal(geometry.max,14);
 assert.equal(geometry.minIndex,2);assert.equal(geometry.maxIndex,3);
 assert.equal(geometry.xy[3].y,8); // the high sits at the top of the 62px band (70 − 62)
 assert.equal(geometry.xy[2].y,70); // the low sits on the baseline
 assert.equal(geometry.delta,10);assert.equal(geometry.deltaTone,"up");
 assert.equal(geometry.line.split(" ").length,5);
 assert.equal(geometry.maLine,null);
});

test("a narrow range keeps only the trailing window, falling back to the full series when too short",()=>{
 const points=series(Array.from({length:60},(_,i)=>10+i),1);
 assert.equal(chartGeometry(points,7,undefined,undefined,false).chartPoints.length,8);
 const sparse=series([10,20],1);
 assert.equal(chartGeometry(sparse,7,undefined,undefined,false).chartPoints.length,2);
});

test("the detail chart carries a trailing-30-day mean and overlays share the scale",()=>{
 const points=series(Array.from({length:40},(_,i)=>100+(i%5)),1);
 const overlay={label:"S&P 500",points:series(Array.from({length:40},()=>150),1)};
 const geometry=chartGeometry(points,90,[overlay],[{date:points[10].date,quantity:3},{date:points[20].date,quantity:9}],true);
 assert.equal(geometry.maLine.split(" ").length,40);
 assert.equal(geometry.max,150); // the overlay stretches the scale
 assert.equal(geometry.overlays.length,1);
 assert.equal(geometry.overlays[0].line.split(" ").length,40);
 assert.equal(geometry.maxQuantity,9);
 assert.equal(geometry.volumeByDate.get(points[10].date),3);
 assert.ok(geometry.barWidth>=1.4&&geometry.barWidth<=7);
});
