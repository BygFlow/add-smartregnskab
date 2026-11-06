import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("sessions expire after inactivity on both server and client", () => {
  const root = process.cwd();
  const auth = readFileSync(join(root, "server", "auth.ts"), "utf8");
  const storage = readFileSync(join(root, "server", "storage.ts"), "utf8");
  const idle = readFileSync(join(root, "client", "src", "lib", "use-idle-session.ts"), "utf8");
  const app = readFileSync(join(root, "client", "src", "App.tsx"), "utf8");

  assert.match(auth, /SESSION_IDLE_MINUTES/);
  assert.match(auth, /updateSessionExpiry/);
  assert.match(auth, /expiresAt > nextExpiry/);
  assert.match(auth, /code:\s*"session_inaktiv"/);
  assert.match(storage, /updateSessionExpiry\(token: string, expiresAt: string\)/);
  assert.match(idle, /30 \* 60_000/);
  assert.match(idle, /2 \* 60_000/);
  assert.match(app, /Du bliver snart logget ud/);
  assert.match(app, /Fortsæt sessionen/);
});
