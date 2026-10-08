import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStoredFileObjectPath } from "../server/file-object-location";

test("kun virksomhedsafgrænsede originalstier accepteres", () => {
  assert.deepEqual(parseStoredFileObjectPath("s3:7/abc.pdf", 7), { storage: "s3", key: "7/abc.pdf" });
  assert.deepEqual(parseStoredFileObjectPath("disk:7/abc.png", 7), { storage: "disk", key: "7/abc.png" });
  for (const value of ["/storage/abc.pdf", "s3:8/abc.pdf", "s3:7/../secret", "https://example.com/a.pdf", ""]) {
    assert.throws(() => parseStoredFileObjectPath(value, 7), /virksomhedsafgrænset/);
  }
});
