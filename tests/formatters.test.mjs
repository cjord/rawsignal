import assert from "node:assert/strict";
import test from "node:test";
import { formatFullDate, formatUtcDate } from "../core/domain/formatters.ts";

// Dates render in UTC everywhere. The Worker renders freshness lines in UTC; a
// browser-local format made the client re-render "Updated Sep 3, 2026" as "Sep 2" for
// any user west of UTC (React hydration error #418 on the set pages, 2026-09-03). This
// suite runs in the developer's local timezone, so it fails if either formatter drifts
// back to local time.
test("full dates format in UTC regardless of the process timezone", () => {
  assert.equal(formatFullDate("2026-09-03T01:00:00Z"), "Sep 3, 2026");
  assert.equal(formatFullDate("2026-09-02T23:30:00-05:00"), "Sep 3, 2026");
  assert.equal(formatFullDate("2026-09-02T20:05:50+0000"), "Sep 2, 2026");
});

test("date-only values format as that UTC day, with or without the year", () => {
  assert.equal(formatUtcDate("2026-09-03"), "Sep 3");
  assert.equal(formatUtcDate("2026-09-03", true), "Sep 3, 2026");
  assert.equal(formatUtcDate("2025-01-17", true), "Jan 17, 2025");
});
