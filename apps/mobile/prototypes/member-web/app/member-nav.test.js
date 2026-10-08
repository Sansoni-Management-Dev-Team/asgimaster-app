import test from "node:test";
import assert from "node:assert/strict";
import { memberNavigation, renderMemberNavigation } from "./member-nav.js";

test("member navigation has all five requested destinations", () => {
  assert.deepEqual(memberNavigation.map(item => item.label), ["Home", "Library", "Events", "Coach", "Support"]);
  assert.deepEqual(memberNavigation.map(item => item.action), ["today", "library", "events", "coach", "support"]);
});

test("All five member pages share one navigation with the correct current page", () => {
  for (const screen of ["home", "library", "events", "coach", "support"]) {
    const markup = renderMemberNavigation(screen);
    assert.equal((markup.match(/<button /g) || []).length, 5);
    assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
    const current = memberNavigation.find(item => item.screen === screen);
    assert.ok(markup.includes(`data-home-action="${current.action}" aria-current="page"`));
  }
});

test("All navigation destinations are pages and icons stay decorative", () => {
  const markup = renderMemberNavigation("home");
  assert.equal((markup.match(/aria-haspopup="dialog"/g) || []).length, 0);
  assert.equal((markup.match(/aria-hidden="true"/g) || []).length, 5);
});
