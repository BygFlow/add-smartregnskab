import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("lazy routes use the one-shot deployment reload guard", async () => {
  const helper = await readFile("client/src/lib/lazy-with-reload.ts", "utf8");
  const app = await readFile("client/src/App.tsx", "utf8");
  const regnskab = await readFile("client/src/pages/regnskabssystem.tsx", "utf8");

  assert.match(helper, /Failed to fetch dynamically imported module/);
  assert.match(helper, /sessionStorage\.setItem/);
  assert.match(helper, /window\.location\.reload\(\)/);
  assert.match(app, /lazyWithReload as lazy/);
  assert.match(regnskab, /lazyWithReload as lazy/);
  assert.doesNotMatch(app, /import \{ lazy,/);
  assert.doesNotMatch(regnskab, /import \{ lazy,/);
});
