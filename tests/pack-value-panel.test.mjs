import assert from "node:assert/strict";
import test from "node:test";
import {renderPackValueFixture} from "./helpers/render-pack-value.mjs";

test("pack EV rows expose monetary values, coverage, chase share, and honest unknowns",()=>{
 const html=renderPackValueFixture();
 for(const text of ["Where the value sits","Estimated partial value per pack","9.1%","7× per pack","1 in 12 packs","8/10 priced","N/A","Incomplete pricing","Pull rate unavailable","not treated as zero","2026-09-18"])assert.ok(html.includes(text),text);
 assert.match(html,/width:63\.636/); // $7 of the $11 subtotal, not odds or row-relative scaling.
 assert.match(html,/width:0%/);
 assert.equal((html.match(/pack-chase-badge/g)||[]).length,2);
});
