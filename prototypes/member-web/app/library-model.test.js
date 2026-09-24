import test from "node:test";
import assert from "node:assert/strict";
import { createMember, completeLesson } from "./home-model.js";
import { getLibrary, libraryCatalogue, contentState, requiredMembership } from "./library-model.js";

test("included collections reflect Growth access without showing locked workshops", () => {
  const d = getLibrary(createMember());
  assert.deepEqual(d.groups.map(group => group.id), ["foundations", "growth", "leadership", "sessions"]);
  assert.equal(d.includedCount, 6);
  assert.equal(d.comingSoonCount, 1);
  assert.equal(d.lockedCount, 1);
  assert.equal(d.items.some(item => item.id === "scaling"), false);
  assert.equal(d.groups[0].completed, 2);
});

test("Essentials and paused members see only foundation collections by default", () => {
  for (const membership of ["essentials", "paused"]) {
    const d = getLibrary(createMember({ membership }));
    assert.equal(d.includedCount, 3);
    assert.deepEqual(d.groups.map(group => group.id), ["foundations"]);
    assert.equal(d.items.every(item => item.access === "foundation"), true);
  }
});

test("Explore all shows public locked metadata with explicit membership requirements", () => {
  const member = createMember({ membership: "essentials" });
  const d = getLibrary(member, { scope: "all" });
  assert.equal(d.items.length, 8);
  assert.equal(d.items.filter(item => contentState(member, item) === "locked").length, 5);
  assert.equal(requiredMembership(d.items.find(item => item.id === "scaling")), "Master");
});

test("unavailable is distinct from locked and never gets a learning progress state", () => {
  const item = libraryCatalogue.find(item => item.id === "live-review");
  assert.equal(contentState(createMember(), item), "unavailable");
  assert.equal(contentState(createMember({ membership: "essentials" }), item), "locked");
  assert.equal(getLibrary(createMember(), { progress: "not-started" }).items.includes(item), false);
});

test("search is case-insensitive, tokenized, trimmed, and respects entitlements", () => {
  assert.deepEqual(getLibrary(createMember(), { query: "  GROWTH   BLUEPRINT  " }).items.map(item => item.id), ["blueprint"]);
  assert.equal(getLibrary(createMember({ membership: "essentials" }), { query: "blueprint" }).items.length, 0);
  assert.equal(getLibrary(createMember({ membership: "essentials" }), { query: "blueprint", scope: "all" }).items.length, 1);
});

test("search also matches topics and collection names", () => {
  assert.equal(getLibrary(createMember(), { query: "ownership" }).items.some(item => item.id === "delegate"), true);
  assert.equal(getLibrary(createMember(), { query: "Live sessions" }).items.length, 1);
  assert.equal(getLibrary(createMember(), { query: "Your foundations" }).items.filter(item => item.collection === "foundations").length, 3);
});

test("collection, query and progress filters compose", () => {
  const d = getLibrary(createMember(), { collection: "foundations", progress: "completed", query: "priorities" });
  assert.deepEqual(d.items.map(item => item.id), ["priorities"]);
  assert.equal(d.overview, false);
  assert.deepEqual(getLibrary(createMember(), { progress: "in-progress" }).items.map(item => item.id), ["blueprint"]);
});

test("membership changes reconcile now-ineligible collection selection", () => {
  const d = getLibrary(createMember({ membership: "essentials" }), { collection: "growth" });
  assert.equal(d.collection, "all");
  assert.equal(d.overview, true);
  assert.equal(d.items.length, 3);
});

test("payment grace period retains Growth collections", () => {
  assert.deepEqual(getLibrary(createMember({ membership: "payment" })).items, getLibrary(createMember()).items);
});

test("completed lessons and collection progress update from shared member state", () => {
  const member = createMember();
  completeLesson(member, "blueprint");
  assert.equal(getLibrary(member, { progress: "in-progress" }).items.length, 0);
  assert.equal(getLibrary(member, { progress: "completed" }).items.length, 3);
  assert.equal(getLibrary(member).groups.find(group => group.id === "growth").completed, 1);
});

test("empty catalogue and no-match results are safe", () => {
  const d = getLibrary(createMember(), {}, []);
  assert.equal(d.items.length, 0);
  assert.equal(d.groups.length, 0);
  assert.equal(d.includedCount, 0);
  assert.equal(getLibrary(createMember(), { query: "zzzz-no-result" }).items.length, 0);
});

test("invalid filter values cannot broaden the default access scope", () => {
  const d = getLibrary(createMember({ membership: "essentials" }), { scope: "everything", collection: "unknown", progress: "unknown" });
  assert.equal(d.scope, "included");
  assert.equal(d.collection, "all");
  assert.equal(d.progress, "all");
  assert.equal(d.items.length, 3);
});
