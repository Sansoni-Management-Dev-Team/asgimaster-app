import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { landscapeStage } from "./player-presentation.js";
import { lessons, createMember, recordWatch, completeLesson, getDashboard } from "./home-model.js";
import { playerContext, resumePosition, watchedSeconds, restoreProgress, persistProgress, PROGRESS_KEY } from "./player-model.js";
const storage = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };

test("video placeholders use a token-derived static gradient without text or caption cues", () => {
  const generator = readFileSync(new URL("./generate-demo-videos.js", import.meta.url), "utf8");
  const poster = readFileSync(new URL("./assets/video/poster.svg", import.meta.url), "utf8");
  const tokens = readFileSync(new URL("../design-system/tokens.css", import.meta.url), "utf8");
  assert.match(generator, /gradients=.*speed=0:d=\$\{duration\}/);
  assert.doesNotMatch(generator, /drawtext|drawbox/);
  assert.match(poster, /<linearGradient/);
  assert.doesNotMatch(poster, /<text\b|<image\b/);
  for (const name of ["start", "end"]) {
    const color = tokens.match(new RegExp(`--color-background-${name}: (#[0-9a-f]+);`, "i"))[1];
    assert.ok(poster.includes(`stop-color="${color}"`));
  }
  for (const lesson of lessons) {
    const captions = readFileSync(new URL(`./assets/video/${lesson.id}.vtt`, import.meta.url), "utf8");
    assert.match(captions, /^WEBVTT/);
    assert.doesNotMatch(captions, /-->/);
  }
});

test("placeholder copy no longer describes teaching cards or their embedded text", () => {
  const js = readFileSync(new URL("./player.js", import.meta.url), "utf8");
  assert.match(js, /silent gradient placeholder/);
  assert.match(js, /This placeholder has no audio, text or lesson footage/);
  assert.doesNotMatch(js, /three teaching cards|persistent labels read|Make it practical/);
});

test("expanded video stage stays landscape across portrait, landscape and square viewports", () => {
  assert.deepEqual(landscapeStage(390, 844), { rotate: true, width: 844, height: 390 });
  assert.deepEqual(landscapeStage(844, 390), { rotate: false, width: 844, height: 390 });
  assert.deepEqual(landscapeStage(320, 568), { rotate: true, width: 568, height: 320 });
  assert.deepEqual(landscapeStage(500, 500), { rotate: false, width: 500, height: 500 });
});

test("inline player exposes only play and fullscreen while extra playback settings stay in options", () => {
  const css = readFileSync(new URL("./player.css", import.meta.url), "utf8");
  const js = readFileSync(new URL("./player.js", import.meta.url), "utf8");
  assert.match(css, /\.player-fullscreen-only \{ display: none;/);
  assert.match(css, /\.player-media\.is-expanded \.player-skip-controls \{ display: flex;/);
  assert.match(css, /\.player-skip-controls \{[^}]*left: var\(--player-edge\);[^}]*bottom: var\(--player-edge\);/);
  assert.match(css, /#player-play \{[^}]*left: 50%; top: 50%;/);
  assert.match(js, /aria-label="Playback options"/);
  assert.equal(js.includes('class="player-transport"'), false);
  assert.equal(js.includes('id="player-percent"'), false);
});

test("lesson navigation stays in the entitled collection and includes replays", () => {
  const member = createMember();
  const first = playerContext(member, "direction");
  assert.equal(first.previous, undefined);
  assert.equal(first.next.id, "priorities");
  const middle = playerContext(member, "priorities");
  assert.equal(middle.previous.id, "direction");
  assert.equal(middle.next.id, "rhythm");
  assert.equal(playerContext(member, "rhythm").next, undefined);
  assert.deepEqual(playerContext(member, "blueprint").queue.map(item => item.id), ["blueprint", "review"]);
});
test("direct links cannot bypass unavailable or locked content", () => {
  assert.equal(playerContext(createMember(), "live-review").state, "unavailable");
  assert.equal(playerContext(createMember(), "scaling").state, "locked");
  assert.equal(playerContext(createMember(), "missing").state, "missing");
  for (const membership of ["essentials", "paused"]) {
    const state = playerContext(createMember({ membership }), "blueprint");
    assert.equal(state.state, "locked"); assert.deepEqual(state.queue, []);
  }
  assert.equal(playerContext(createMember({ membership: "payment" }), "blueprint").state, "ready");
});
test("resume clamps invalid positions and replays finished recordings", () => {
  assert.equal(resumePosition(480, 960), 480);
  assert.equal(resumePosition(-5, 960), 0);
  assert.equal(resumePosition(5000, 960), 0);
  assert.equal(resumePosition(60, NaN), 0);
  assert.equal(resumePosition(60, 0), 0);
});
test("watch accounting ignores seeks and background gaps, respects speed", () => {
  assert.equal(watchedSeconds(10, 11, 1), 1);
  assert.equal(watchedSeconds(10, 12, 1, 2), 1);
  assert.equal(watchedSeconds(10, 10.75, 1, .75), 1);
  assert.equal(watchedSeconds(10, 30, 1), 0);
  assert.equal(watchedSeconds(30, 10, 1), 0);
  assert.equal(watchedSeconds(10, 30, 20), 0);
  assert.equal(watchedSeconds(0, Infinity, 1), 0);
});
test("playback position and completion survive reload and update dashboards", () => {
  const local = storage(); const member = createMember({ fresh: true });
  recordWatch(member, "direction", 100, 5); completeLesson(member, "priorities");
  assert.equal(persistProgress(member, local), true);
  const restored = restoreProgress(createMember({ fresh: true }), local);
  assert.equal(restored.positions.direction, 100);
  assert.deepEqual(restored.completed, ["priorities"]);
  assert.equal(restored.weeklyMinutes, 5 / 60);
  assert.equal(getDashboard(restored, { name: "Focus", success: "" }).resume.id, "direction");
  assert.equal(JSON.parse(local.getItem(PROGRESS_KEY)).membership, undefined);
});
test("corrupt and blocked storage leave a usable in-memory player", () => {
  const member = createMember(); const local = storage(); local.setItem(PROGRESS_KEY, "bad json");
  assert.deepEqual(restoreProgress(createMember(), local), member);
  assert.equal(persistProgress(member, null), false);
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); } };
  assert.deepEqual(restoreProgress(createMember(), blocked), member);
  assert.equal(persistProgress(member, blocked), false);
});
test("untrusted stored progress is bounded and cannot alter membership", () => {
  const local = storage(); local.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, membership: "growth", positions: { direction: 9000, priorities: -10, unknown: 5 }, completed: ["direction", "direction", "unknown"], weeklyCompleted: ["unknown"], weeklyMinutes: -2 }));
  const member = restoreProgress(createMember({ membership: "essentials" }), local);
  assert.equal(member.membership, "essentials");
  assert.deepEqual(member.positions, { direction: 720, priorities: 0 });
  assert.deepEqual(member.completed, ["direction"]);
  assert.equal(member.weeklyMinutes, 0);
});
