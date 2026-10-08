import Database from "better-sqlite3";
import { verifyBookkeepingArchiveReceipt } from "../server/bookkeeping-archive-restore";

async function main() {
  const dbPath = process.env.DATABASE_PATH;
  const receiptId = Number(process.env.ARCHIVE_RECEIPT_ID);
  if (!dbPath || !Number.isSafeInteger(receiptId) || receiptId <= 0) {
    throw new Error("DATABASE_PATH og ARCHIVE_RECEIPT_ID kræves til en læsende gendannelseskontrol.");
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const result = await verifyBookkeepingArchiveReceipt(db, receiptId);
    console.log(JSON.stringify(result));
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Gendannelseskontrollen fejlede.");
  process.exitCode = 1;
});
