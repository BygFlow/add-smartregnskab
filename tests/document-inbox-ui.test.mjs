import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../client/src/pages/regnskabssystem.tsx", import.meta.url), "utf8");

test("bilagsindbakken forklarer datosortering, mailkilde og sikre bankforslag", () => {
  assert.match(page, /Bilag sorteres automatisk efter fakturadato/);
  assert.match(page, /mailens afsender kan ses/);
  assert.match(page, /Fakturadato ↑/);
  assert.match(page, /item\.senderEmail/);
  assert.match(page, /Kontrollér i bank/);
  assert.match(page, /Intet sikkert forslag/);
});
