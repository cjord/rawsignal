import assert from "node:assert/strict";
import test from "node:test";
import {disclosurePlacement,disclosureSide} from "../app/hooks/useDisclosurePopover.ts";

test("places history above when it fits and below near the viewport top",()=>{
 assert.equal(disclosurePlacement(500,320),"above");
 assert.equal(disclosurePlacement(300,320),"below");
});

test("keeps a popover right when it fits and flips it left at the edge",()=>{
 assert.equal(disclosureSide(500,430,1200),"right");
 assert.equal(disclosureSide(900,430,1200),"left");
});
