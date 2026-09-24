import "dotenv/config";
import { fileURLToPath } from "node:url";
import { ensureSimplyMailForward, forwardConfiguration } from "./simply-mail-forward-core.mjs";
export { ensureSimplyMailForward, forwardConfiguration } from "./simply-mail-forward-core.mjs";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = await ensureSimplyMailForward({
      config: forwardConfiguration(), apiKey: process.env.SIMPLY_API_KEY,
      apply: process.argv.includes("--apply"),
    });
    console.log(`Simply-videresendelse: ${result.status}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Videresendelse mislykkedes.");
    process.exitCode = 1;
  }
}
