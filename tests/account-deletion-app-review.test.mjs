import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("administrator can initiate account deletion separately from subscription cancellation", async () => {
  const [routes, subscriptionPage] = await Promise.all([
    read("../server/routes.ts"),
    read("../client/src/pages/regnskab-tabs/abonnement.tsx"),
  ]);

  assert.match(routes, /app\.post\("\/api\/account\/deletion-request"/);
  assert.match(routes, /confirmation[^\n]+SLET KONTO/);
  assert.match(routes, /autoRenew: 0/);
  assert.match(routes, /subjectType: "bruger"/);
  assert.match(routes, /lovpligtigt regnskabsmateriale/i);
  assert.match(subscriptionPage, /Anmod om permanent kontosletning/);
  assert.match(subscriptionPage, /Handlingen er ikke det samme som en almindelig abonnementsopsigelse/);
  assert.match(subscriptionPage, /Lovpligtigt regnskabsmateriale/);
  assert.match(subscriptionPage, /data-testid="button-confirm-account-deletion"/);
});

test("iOS and Android release numbers are incremented for the deletion flow", async () => {
  const [project, infoPlist, gradle, pkg] = await Promise.all([
    read("../ios/App/App.xcodeproj/project.pbxproj"),
    read("../ios/App/App/Info.plist"),
    read("../android/app/build.gradle"),
    read("../package.json"),
  ]);

  assert.match(project, /CURRENT_PROJECT_VERSION = 31607;/);
  assert.match(project, /MARKETING_VERSION = 3\.16\.4;/);
  assert.match(infoPlist, /<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>/);
  assert.match(infoPlist, /også når appen midlertidigt er i baggrunden/);
  assert.match(gradle, /versionCode 30/);
  assert.match(gradle, /versionName "3\.16\.4"/);
  assert.equal(JSON.parse(pkg).version, "3.16.4");
});
