import { build } from "esbuild";

await build({
  entryPoints: ["services/edi-gateway/index.ts"],
  outfile: "dist/edi-gateway.cjs",
  platform: "node",
  format: "cjs",
  bundle: true,
  target: "node20",
  packages: "external",
  tsconfig: "tsconfig.json",
  logLevel: "info",
});
