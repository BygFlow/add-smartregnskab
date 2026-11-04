import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { companies, notifications } from "../shared/schema";
import { db } from "../server/storage";
import {
  ensureNemhandelRegistrationNotice,
  NEMHANDEL_REGISTRATION_NOTICE_TITLE,
} from "../server/nemhandel-registration-notice";

test("NemHandel-meddelelsen aktiveres først efter registrering og oprettes kun én gang", async () => {
  const previous = process.env.ERST_REGISTRATION_FOB_NUMBER;
  const companyId = 986_411;
  db.insert(companies).values({ id: companyId, name: "NemHandel notice test", cvr: "12345678" }).onConflictDoNothing().run();
  db.delete(notifications).where(eq(notifications.companyId, companyId)).run();
  try {
    delete process.env.ERST_REGISTRATION_FOB_NUMBER;
    assert.equal(await ensureNemhandelRegistrationNotice(companyId), false);
    assert.equal(db.select().from(notifications).where(eq(notifications.companyId, companyId)).all().length, 0);

    process.env.ERST_REGISTRATION_FOB_NUMBER = "fob123456";
    assert.equal(await ensureNemhandelRegistrationNotice(companyId), true);
    assert.equal(await ensureNemhandelRegistrationNotice(companyId), false);
    const rows = db.select().from(notifications).where(eq(notifications.companyId, companyId)).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.title, NEMHANDEL_REGISTRATION_NOTICE_TITLE);
  } finally {
    if (previous == null) delete process.env.ERST_REGISTRATION_FOB_NUMBER;
    else process.env.ERST_REGISTRATION_FOB_NUMBER = previous;
    db.delete(notifications).where(eq(notifications.companyId, companyId)).run();
    db.delete(companies).where(eq(companies.id, companyId)).run();
  }
});
