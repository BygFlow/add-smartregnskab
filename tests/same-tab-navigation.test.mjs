import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const root = join(process.cwd(), "client", "src");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test("SmartRegnskab navigation and downloads never request a new browser window", () => {
  const offenders = sourceFiles(root).filter((file) => {
    const source = readFileSync(file, "utf8");
    return /\bwindow\.open\s*\(|\btarget\s*=\s*["']_blank|\.target\s*=\s*["']_blank/.test(source);
  }).map((file) => relative(root, file));
  assert.deepEqual(offenders, []);
});

test("authenticated file helper downloads without redirecting or opening another tab", () => {
  const source = readFileSync(join(root, "lib", "queryClient.ts"), "utf8");
  const helper = source.slice(source.indexOf("export async function openAuthedFile"), source.indexOf("function headerFilename"));
  assert.match(helper, /link\.download\s*=/);
  assert.doesNotMatch(helper, /link\.target|window\.open|location\.assign/);
});
