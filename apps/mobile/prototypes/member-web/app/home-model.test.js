import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lessons, createMember, getDashboard, canWatch, recordWatch, completeLesson } from "./home-model.js";

const goal = { name: "Grow with focus", success: "Define three growth priorities and turn them into a weekly action plan.", weeks: "12" };

test("Home metric numerals use a natural-width font and positive tracking without distortion", () => {
  const css = readFileSync(new URL("./home.css", import.meta.url), "utf8");
  const tokens = readFileSync(new URL("../design-system/tokens.css", import.meta.url), "utf8");
  const stack = tokens.match(/--font-dashboard-numbers:\s*([^;]+);/)[1];
  const value = css.match(/\.home-metric__value\s*\{([^}]+)\}/)[1];
  assert.match(stack, /"DIN Pro", "DINPro", Arial,/);
  assert.doesNotMatch(stack, /Narrow|Condensed/);
  assert.match(value, /font-family: var\(--font-dashboard-numbers\)/);
  assert.match(value, /font-stretch: normal/);
  assert.match(value, /letter-spacing: \.025em/);
  assert.doesNotMatch(value, /transform:|scale:/);
});

test("Home uses transparent metric rings without redundant header copy or a weeks badge", () => {
  const markup = readFileSync(new URL("./home.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("./home.css", import.meta.url), "utf8");
  for (const removed of ["Good to see you", "home-overview-title", "home-plan-link"]) assert.equal(markup.includes(removed), false);
  assert.ok(markup.includes('aria-label="Learning progress"'));
  assert.match(css, /\.home-ring \{[^}]*background: transparent;/);
  assert.match(css, /\.home-ring circle \{[^}]*fill: none;/);
});

test("returning members resume their unfinished entitled lesson", () => {
  const view = getDashboard(createMember(), goal);
  assert.equal(view.resume.id, "blueprint");
  assert.equal(view.coursePercent, 33);
  assert.equal(view.actionsDone, 1);
  assert.equal(view.weeklyMinutes, 26);
  assert.ok(view.recommendations.every(item => item.id !== "blueprint" && !["direction", "priorities"].includes(item.id)));
});
test("restricted members never resume, recommend, play, or complete a locked lesson", () => {
  for (const membership of ["essentials", "paused"]) {
    const member = createMember({ membership });
    const view = getDashboard(member, goal);
    assert.equal(view.resume, undefined);
    assert.equal(view.coursePercent, 67);
    assert.ok(view.recommendations.every(item => canWatch(member, item)));
    assert.equal(view.nextLesson.id, "rhythm");
    assert.equal(recordWatch(member, "blueprint", 900), false);
    assert.equal(completeLesson(member, "blueprint"), false);
    assert.equal(member.positions.blueprint, 480);
  }
});
test("payment notice leaves grace-period learning access intact", () => {
  const view = getDashboard(createMember({ membership: "payment" }), goal);
  assert.equal(view.membership.status, "payment_due");
  assert.equal(view.entitled.length, 6);
  assert.equal(view.nextLesson.id, "blueprint");
});
test("new members get a start action with no phantom resume or progress", () => {
  const view = getDashboard(createMember({ fresh: true }), goal);
  assert.equal(view.resume, undefined);
  assert.equal(view.coursePercent, 0);
  assert.equal(view.actionsDone, 0);
  assert.equal(view.weeklyMinutes, 0);
  assert.equal(view.next.label, "Start learning");
});
test("the goal changes the ranking of eligible unstarted lessons", () => {
  const member = createMember({ fresh: true });
  const leadership = getDashboard(member, { name: "Lead my team", success: "Delegate responsibilities with clear ownership" });
  assert.equal(leadership.nextLesson.id, "delegate");
  assert.notEqual(getDashboard(member, goal).nextLesson.id, "delegate");
});
test("completion updates progress and advances the next action only once", () => {
  const member = createMember();
  assert.equal(completeLesson(member, "blueprint"), true);
  assert.equal(completeLesson(member, "blueprint"), true);
  const view = getDashboard(member, goal);
  assert.equal(view.coursePercent, 50);
  assert.equal(view.complete.length, 3);
  assert.notEqual(view.nextLesson.id, "blueprint");
  assert.equal(member.weeklyCompleted.filter(id => id === "blueprint").length, 1);
});
test("all lessons complete leads to focus, reflection, then an up-to-date state", () => {
  const member = createMember();
  lessons.forEach(lesson => completeLesson(member, lesson.id));
  assert.equal(getDashboard(member, goal).next.kind, "focus");
  member.focusDone = true;
  assert.equal(getDashboard(member, goal).next.kind, "reflection");
  member.reflectionDone = true;
  const view = getDashboard(member, goal);
  assert.equal(view.next.kind, "progress");
  assert.equal(view.recommendations.length, 0);
  assert.equal(view.coursePercent, 100);
  assert.equal(view.actionsDone, 3);
});
test("seeking is bounded and does not inflate learning minutes", () => {
  const member = createMember();
  recordWatch(member, "blueprint", 99999);
  assert.equal(member.positions.blueprint, 960);
  assert.equal(member.weeklyMinutes, 26);
  recordWatch(member, "blueprint", -20, 60);
  assert.equal(member.positions.blueprint, 0);
  assert.equal(member.weeklyMinutes, 27);
});
