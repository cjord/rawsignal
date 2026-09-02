import test from "node:test";import assert from "node:assert/strict";
import {classifyRegime} from "../core/domain/regime.ts";

const series=prices=>prices.map((price,index)=>({date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),price}));
const flat=(price,days)=>Array.from({length:days},()=>price);

test("regime classifier needs usable history",()=>{
 assert.equal(classifyRegime([]),null);
 assert.equal(classifyRegime(series([10,10.5,11])),null); // <5 points in 90d
});

test("a steady flat series is steady",()=>{
 assert.equal(classifyRegime(series(flat(10,40)))?.regime,"steady");
});

test("a sustained decline is falling; a recovery off the bottom is improving",()=>{
 // 40 days sliding from $20 to $12: down >5% over 30d, still slipping this week.
 const fall=series(Array.from({length:40},(_,i)=>20-i*.2));
 assert.equal(classifyRegime(fall)?.regime,"falling");
 // Same crash but the last week turns up from a deep drawdown → improving.
 const rebound=series([...Array.from({length:33},(_,i)=>20-i*.25),12,12.2,12.4,12.6,12.8,13,13.2]);
 assert.equal(classifyRegime(rebound)?.regime,"improving");
});

test("near the high, accelerating momentum is breakout and fading momentum is overextended",()=>{
 // Flat $10 base then a steady climb through the high with a strong week.
 const breakout=series([...flat(10,25),10.4,10.8,11.2,11.6,12,12.4,12.8,13.2,13.6,14]);
 assert.equal(classifyRegime(breakout)?.regime,"breakout");
 // Rose earlier, sits at the high but this week went nowhere → overextended.
 const stall=series([...flat(10,20),11,12,13,13.5,14,...flat(14,10)]);
 assert.equal(classifyRegime(stall)?.regime,"overextended");
});

test("one outsized adjacent-day jump reads as a spike",()=>{
 assert.equal(classifyRegime(series([...flat(10,30),13]))?.regime,"spike");
});

test("cooling demand vetoes breakout",()=>{
 const breakout=series([...flat(10,25),10.4,10.8,11.2,11.6,12,12.4,12.8,13.2,13.6,14]);
 const cooled=classifyRegime(breakout,null,{recent:5,prior:30,change:-83.3});
 assert.equal(cooled?.regime,"overextended");
});

test("low cohort breadth vetoes breakout; broad participation supports it (P4)",()=>{
 const breakout=series([...flat(10,25),10.4,10.8,11.2,11.6,12,12.4,12.8,13.2,13.6,14]);
 // A lone spike while only 20% of the cohort rises is not a breakout.
 assert.notEqual(classifyRegime(breakout,null,null,20)?.regime,"breakout");
 // The same shape with 60% of the cohort rising keeps the label (and cites the breadth).
 const supported=classifyRegime(breakout,null,null,60);
 assert.equal(supported?.regime,"breakout");
 assert.match(supported.detail,/60% of its cohort rising/);
 // Unknown breadth stays neutral — price evidence alone still classifies.
 assert.equal(classifyRegime(breakout)?.regime,"breakout");
});
