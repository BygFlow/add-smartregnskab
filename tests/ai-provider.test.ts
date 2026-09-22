import assert from "node:assert/strict";
import test from "node:test";

import { aiProviderConfigured, estimateOpenAiCostDkk, extractOpenAiText } from "../server/ai-provider";

test("extracts text from a raw Responses API payload", () => {
  assert.equal(extractOpenAiText({
    output: [{ type: "message", content: [{ type: "output_text", text: "  Dansk svar  " }] }],
  }), "Dansk svar");
  assert.equal(extractOpenAiText({ output_text: "Direkte svar" }), "Direkte svar");
});

test("estimates provider cost from measured token usage", () => {
  const before = {
    input: process.env.OPENAI_INPUT_USD_PER_MILLION,
    output: process.env.OPENAI_OUTPUT_USD_PER_MILLION,
    rate: process.env.OPENAI_USD_DKK_RATE,
  };
  process.env.OPENAI_INPUT_USD_PER_MILLION = "1";
  process.env.OPENAI_OUTPUT_USD_PER_MILLION = "2";
  process.env.OPENAI_USD_DKK_RATE = "7";
  assert.equal(estimateOpenAiCostDkk(1_000_000, 500_000), 14);
  if (before.input === undefined) delete process.env.OPENAI_INPUT_USD_PER_MILLION; else process.env.OPENAI_INPUT_USD_PER_MILLION = before.input;
  if (before.output === undefined) delete process.env.OPENAI_OUTPUT_USD_PER_MILLION; else process.env.OPENAI_OUTPUT_USD_PER_MILLION = before.output;
  if (before.rate === undefined) delete process.env.OPENAI_USD_DKK_RATE; else process.env.OPENAI_USD_DKK_RATE = before.rate;
});

test("requires an API key before enabling the paid provider", () => {
  const before = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  assert.equal(aiProviderConfigured(), false);
  process.env.OPENAI_API_KEY = "test-key";
  assert.equal(aiProviderConfigured(), true);
  if (before === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = before;
});
