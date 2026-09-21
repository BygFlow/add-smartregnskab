import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("annual posting tiers are shared by pricing, billing and customer usage", () => {
  const pricing = read("shared/posting-pricing.ts");
  const domain = read("server/domain.ts");
  const marketing = read("client/src/pages/marketing.tsx");

  for (const [limit, surcharge] of [[1_000, 0], [2_000, 99], [5_000, 249], [10_000, 449], [25_000, 699], [50_000, 899], [100_000, 1_199]]) {
    assert.match(pricing, new RegExp(`annualLimit: ${limit.toLocaleString("en-US").replaceAll(",", "[_ ,]?")}`));
    assert.match(pricing, new RegExp(`monthlySurcharge: ${surcharge.toLocaleString("en-US").replaceAll(",", "[_ ,]?")}`));
  }
  assert.match(domain, /postingUsage\.tier\.monthlySurcharge/);
  assert.match(domain, /organizationPostingUsage/);
  assert.match(domain, /storage\.all\("journal_lines"/);
  assert.match(domain, /lineCountByEntry/);
  assert.match(marketing, /POSTING_PRICE_TIERS\.map/);
  assert.match(marketing, /Ubegrænset bilagsopbevaring/);
});
