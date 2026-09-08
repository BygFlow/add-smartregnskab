import { readFile } from "node:fs/promises";

const shell = await readFile(new URL("../client/src/pages/regnskabs-shell.tsx", import.meta.url), "utf8");
const content = await readFile(new URL("../client/src/pages/regnskabssystem.tsx", import.meta.url), "utf8");

const matches = (source, expression) => [...source.matchAll(expression)].map((match) => match[1]);
const navPaths = matches(shell, /\{ path: "([^"]+)"/g);
const navTabs = matches(shell, /tab: "([^"]+)"/g);
const contentTabs = matches(content, /<TabsContent value="([^"]+)"/g);

const duplicates = (items) => [...new Set(items.filter((item, index) => items.indexOf(item) !== index))];
const missingContent = [...new Set(navTabs)].filter((tab) => !contentTabs.includes(tab));
const orphanContent = [...new Set(contentTabs)].filter((tab) => !navTabs.includes(tab));
const failures = [];

if (duplicates(navPaths).length) failures.push(`Dublerede navigationsstier: ${duplicates(navPaths).join(", ")}`);
if (duplicates(navTabs).length) failures.push(`Dublerede modulfane-id'er: ${duplicates(navTabs).join(", ")}`);
if (missingContent.length) failures.push(`Moduler uden indhold: ${missingContent.join(", ")}`);
if (orphanContent.length) failures.push(`Indhold uden navigation: ${orphanContent.join(", ")}`);

if (failures.length) {
  throw new Error(`Modulrevision fejlede:\n- ${failures.join("\n- ")}`);
}

const betaLabels = (shell.match(/\(beta\)/gi) ?? []).length;
console.log(`Modulrevision OK: ${navPaths.length} navigationselementer, ${new Set(navTabs).size} moduler med indhold, ${betaLabels} tydeligt markerede betaområder.`);
