import assert from "node:assert/strict";
import test from "node:test";
import {filterSelectionOptions,toggleSelection} from "../app/filters/selection.ts";

const all=["alpha","beta","gamma"];

test("checkbox selection adds and removes individual options",()=>{
 assert.deepEqual(toggleSelection([],"alpha",all),["alpha"]);
 assert.deepEqual(toggleSelection(["alpha","beta"],"alpha",all),["beta"]);
});

test("selecting every option normalizes to the shared All representation",()=>{
 assert.deepEqual(toggleSelection(["alpha","beta"],"gamma",all),[]);
});

test("shared option search is trimmed and case-insensitive",()=>{
 const options=all.map(label=>({key:label,label}));
 assert.deepEqual(filterSelectionOptions(options,"  BE ").map(option=>option.key),["beta"]);
 assert.equal(filterSelectionOptions(options," ").length,3);
});
