import test from "node:test";
import assert from "node:assert/strict";
import { parseRange } from "./server.js";
test("video ranges support bounded, open-ended, and suffix requests", () => {
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=500-", 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=1-9999", 1000), { start: 1, end: 999 });
});
test("invalid media ranges are rejected", () => {
  for (const range of ["bytes=1000-", "bytes=5-4", "bytes=-0", "bytes=-", "bytes=0-1,3-4", "bytes=Infinity-"]) assert.equal(parseRange(range, 1000), null);
  assert.equal(parseRange("bytes=0-1", 0), null);
});
