import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("loads design tokens before legacy and component-owned styles", async () => {
  const layout = await read("../app/layout.tsx");
  const imports = [
    '"./styles/tokens.css"',
    '"./globals.css"',
    '"./market-views.css"',
    '"./styles/market-controls.css"',
    '"./styles/market-content.css"',
  ];
  for (const item of imports) assert.match(layout, new RegExp(item.replaceAll(".", "\\.")));
  for (let index = 1; index < imports.length; index += 1) {
    assert.ok(layout.indexOf(imports[index - 1]) < layout.indexOf(imports[index]));
  }
});

test("centralizes shared dimensions, motion, focus, and stacking tokens", async () => {
  const tokens = await read("../app/styles/tokens.css");
  for (const name of [
    "--control-height",
    "--control-radius",
    "--panel-radius",
    "--focus-ring",
    "--motion-fast",
    "--motion-standard",
    "--z-popover",
  ]) assert.match(tokens, new RegExp(name));
  assert.match(tokens, /\[data-theme="dark"\]/);
  assert.match(tokens, /\[data-theme="light"\]/);
});

test("keeps large popover flush with its tile and preserves reduced motion", async () => {
  const [legacy, content] = await Promise.all([
    read("../app/globals.css"),
    read("../app/styles/market-content.css"),
  ]);
  assert.doesNotMatch(legacy + content, /top:\s*-1px|min-height:\s*calc\(100% \+ 2px\)/);
  assert.match(content, /\.view-large \.market-row-shell\[open\] \.hover-card[\s\S]*top: 0 !important;[\s\S]*min-height: 100%;/);
  assert.match(content, /border-(?:left|right)-color: transparent !important/);
  assert.match(content, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transform: none !important/);
});

test("component families own current shared control and disclosure contracts", async () => {
  const [legacy, controls, content] = await Promise.all([
    read("../app/market-views.css"),
    read("../app/styles/market-controls.css"),
    read("../app/styles/market-content.css"),
  ]);
  assert.doesNotMatch(legacy, /Milestone 6: one semantic disclosure/);
  assert.doesNotMatch(legacy, /v41: roomier signal cells/);
  assert.match(controls, /\.controls > \.strictness-control/);
  assert.match(controls, /\.signal-cell/);
  assert.match(content, /\.market-row-shell/);
  assert.match(content, /data-popup-place="below"/);
});
