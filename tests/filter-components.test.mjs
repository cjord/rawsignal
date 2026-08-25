import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("Singles and Sealed compose the same filter primitives",async()=>{
 const [singles,sealed,button,actions,dismissible]=await Promise.all([
  readFile(new URL("../app/CardFilters.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/SealedFilters.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/filters/FilterButton.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/filters/FilterActions.tsx",import.meta.url),"utf8"),
  readFile(new URL("../app/filters/useDismissibleDetails.ts",import.meta.url),"utf8"),
 ]);
 for(const source of [singles,sealed])for(const primitive of ["useDismissibleDetails","FilterButton","RangeFilter","SearchableCheckboxGrid","FilterActions"])assert.match(source,new RegExp(primitive));
 assert.match(button,/active>0&&<em>\{active\}<\/em>/);
 assert.match(button,/filter-chevron/);
 assert.match(actions,/disabled=\{!active\}/);
 assert.match(actions,/onClick=\{onReset\}/);
 assert.match(dismissible,/!root\.current\.contains/);
 assert.match(dismissible,/event\.key!=="Escape"/);
 assert.match(dismissible,/querySelector\("summary"\)\?\.focus/);
});
