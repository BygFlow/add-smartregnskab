import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["-c", "core.quotepath=false", "ls-files", "-z", "server", "client/src", "scripts", "shared"])
  .toString("utf8").split("\0").filter(Boolean);
const findings = [];
const rules = [
  { id: "hardcoded-live-secret", pattern: /(sk_live_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{16})/g },
  { id: "dangerous-eval", pattern: /\beval\s*\(/g },
  { id: "shell-child-process", pattern: /exec\s*\([^)]*req\.(body|query|params)/g },
  { id: "weak-hash-password", pattern: /createHash\s*\(\s*["'](?:md5|sha1)["']\s*\).*password/gi },
];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const rule of rules) if (rule.pattern.test(text)) findings.push({ rule: rule.id, file });
  ruleReset();
}
function ruleReset() { for (const rule of rules) rule.pattern.lastIndex = 0; }
const result = { generatedAt: new Date().toISOString(), checkedFiles: files.length, ok: findings.length === 0, findings };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
