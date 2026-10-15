import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { companies, platformSyncMappings } from "@shared/schema";
import { db } from "../server/storage";
import { registerSproomProductForCompany } from "../server/add-connect";

const companyId = 78101;

test("Pro og Clean genbruger parentprofilen for ADD SmartDrift ApS", () => {
  process.env.EINVOICE_PROVIDER = "sproom";
  process.env.SPROOM_API_TOKEN = "test-master-token";
  process.env.SPROOM_PARENT_CVR = "46761898";
  process.env.PLATFORM_COMPANY_CVR = "46761898";
  db.insert(companies).values({ id: companyId, name: "ADD SmartDrift ApS", cvr: "46761898" }).onConflictDoNothing().run();

  const pro = registerSproomProductForCompany(companyId, "smartdrift_pro");
  const clean = registerSproomProductForCompany(companyId, "smartdrift_clean");

  assert.equal(pro?.reusedParentCompany, true);
  assert.equal(clean?.reusedParentCompany, true);
  assert.equal(pro?.connection.parentCompany, true);
  assert.equal(clean?.connection.parentCompany, true);
  assert.deepEqual(clean?.connection.sourceProducts, ["add_smartregnskab", "smartdrift_pro", "smartdrift_clean"]);

  const links = db.select().from(platformSyncMappings).where(and(
    eq(platformSyncMappings.companyId, companyId),
    eq(platformSyncMappings.syncType, "einvoice_product"),
  )).all();
  assert.equal(links.length, 2);
  assert.equal(links.every((row) => row.targetId === "sproom_parent"), true);
});
