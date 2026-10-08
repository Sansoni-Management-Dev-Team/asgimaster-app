import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMember, canWatch } from "./home-model.js";
import { createCoachState, currentConversation, beginMessage, resolveMessage, failMessage, retryMessage, deleteConversation, buildHandoff, demoReply, loadCoach, saveCoach, coachAccess, COACH_KEY } from "./coach-model.js";
const now = new Date(2026, 8, 7, 12);
const member = () => createMember();
const goal = { name: "Grow with focus", success: "Choose three priorities.", weeks: "12" };
const storage = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }; };
const reply = { text: "Choose one small next step." };

test("Coach composer has an icon-only named send control without the old footer links", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("./coach.js", import.meta.url), "utf8");
  const send = html.match(/<button[^>]*id="coach-send"[\s\S]*?<\/button>/)?.[0];
  assert.ok(send); assert.match(send, /aria-label="Send message"/); assert.match(send, /<svg/);
  assert.equal(send.includes("<span"), false);
  assert.equal(html.includes("coach-help-links"), false); assert.equal(js.includes("coach-send-label"), false);
  assert.ok(js.includes('actionButton("About AaronAI", "about"'));
  assert.ok(js.includes('actionButton("Talk to a person", "handoff"'));
});

test("Coach message caption is visually hidden while its name and required state remain accessible", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /<label class="ds-visually-hidden" for="coach-message">Message AaronAI<\/label>/);
  assert.equal(html.includes("Message AaronAI (required)"), false);
  const field = html.match(/<textarea[^>]*id="coach-message"[^>]*>/)?.[0];
  assert.ok(field);
  assert.match(field, /\srequired\s/);
  assert.match(field, /placeholder="What's on your mind\?"/);
});

test("new coach starts without invented conversations or a usage counter", () => {
  const state = createCoachState(now);
  assert.equal(state.conversations.length, 0);
  assert.equal(currentConversation(state), undefined);
  assert.equal(Object.hasOwn(state, "used"), false);
  assert.equal(Object.hasOwn(state, "day"), false);
});
test("entitlement and API readiness are independent gates", () => {
  assert.equal(coachAccess(createMember({ membership: "paused" })), "locked");
  assert.equal(coachAccess(member(), "waitlist"), "waitlist");
  assert.equal(coachAccess(member(), "unavailable"), "unavailable");
  assert.equal(coachAccess(member(), "unknown-provider-state"), "unavailable");
  for (const mode of ["waitlist", "unavailable"]) assert.ok(beginMessage(createCoachState(now), "Help", member(), mode, now).error);
  assert.ok(beginMessage(createCoachState(now), "Help", createMember({ membership: "paused" }), "demo", now).error);
  assert.equal(coachAccess(createMember({ membership: "essentials" })), "demo");
});
test("messages validate input and block duplicate in-flight requests", () => {
  const state = createCoachState(now);
  assert.ok(beginMessage(state, "  ", member(), "demo", now).error);
  assert.ok(beginMessage(state, "x".repeat(2001), member(), "demo", now).error);
  const first = beginMessage(state, "  Find my focus  ", member(), "demo", now);
  assert.ok(first.chatId); assert.equal(currentConversation(state).messages[0].text, "Find my focus");
  assert.ok(beginMessage(state, "Another", member(), "demo", now).error);
  assert.equal(currentConversation(state).messages.length, 1);
});
test("a successful reply is appended exactly once", () => {
  const state = createCoachState(now), request = beginMessage(state, "Next step", member(), "demo", now);
  assert.equal(resolveMessage(state, request, reply, member(), "demo", now), true);
  assert.equal(resolveMessage(state, request, reply, member(), "demo", now), false);
  assert.equal(currentConversation(state).messages.length, 2);
});
test("failed and stopped replies can retry without duplicates", () => {
  const state = createCoachState(now), request = beginMessage(state, "Plan a week", member(), "demo", now);
  failMessage(state, request);
  assert.equal(currentConversation(state).messages[0].status, "failed");
  assert.ok(beginMessage(state, "Another message", member(), "demo", now).error);
  const retry = retryMessage(state, request.messageId, member(), "demo", now);
  resolveMessage(state, retry, reply, member(), "demo", now);
  assert.equal(currentConversation(state).messages.length, 2);
});
test("prompts continue beyond former daily and per-conversation limits after reload", () => {
  let state = createCoachState(now);
  const local = storage();
  for (let i = 0; i < 125; i++) {
    const request = beginMessage(state, `Question ${i}`, member(), "demo", now);
    assert.equal(request.error, undefined);
    assert.equal(resolveMessage(state, request, reply, member(), "demo", now), true);
    if (i === 60) { saveCoach(state, local); state = loadCoach(local, now); }
  }
  assert.equal(currentConversation(state).messages.length, 250);
  saveCoach(state, local);
  assert.equal(currentConversation(loadCoach(local, now)).messages.length, 250);
});
test("availability changes during a request preserve the message for retry", () => {
  const state = createCoachState(now), request = beginMessage(state, "My focus", member(), "demo", now);
  assert.equal(resolveMessage(state, request, reply, createMember({ membership: "paused" }), "demo", now), false);
  assert.equal(currentConversation(state).messages[0].status, "failed");
});
test("legacy exhausted usage is ignored while history and retries remain usable", () => {
  const state = createCoachState(now), local = storage();
  const first = beginMessage(state, "Existing question", member(), "demo", now);
  failMessage(state, first);
  state.day = "2026-09-07"; state.used = 9999;
  saveCoach(state, local);
  const restored = loadCoach(local, now);
  assert.equal(Object.hasOwn(restored, "used"), false);
  assert.equal(Object.hasOwn(restored, "day"), false);
  const retry = retryMessage(restored, first.messageId, member(), "demo");
  assert.equal(retry.error, undefined);
  assert.equal(resolveMessage(restored, retry, reply, member(), "demo", now), true);
  assert.equal(beginMessage(restored, "Another question", member(), "demo", now).error, undefined);
});
test("history reload preserves content and selection; pending becomes retryable", () => {
  const state = createCoachState(now), request = beginMessage(state, "First question", member(), "demo", now);
  resolveMessage(state, request, reply, member(), "demo", now);
  beginMessage(state, "Unfinished question", member(), "demo", now);
  state.waitlisted = true;
  const local = storage(); saveCoach(state, local);
  const restored = loadCoach(local, now);
  assert.equal(restored.activeId, state.activeId);
  assert.equal(restored.waitlisted, true); assert.equal(currentConversation(restored).messages.at(-1).status, "failed");
  assert.match(currentConversation(restored).messages.at(-1).failure, /interrupted/);
});
test("deleting one conversation retains the other history", () => {
  const state = createCoachState(now), first = beginMessage(state, "First", member(), "demo", now);
  resolveMessage(state, first, reply, member(), "demo", now); state.activeId = null;
  const second = beginMessage(state, "Second", member(), "demo", now);
  resolveMessage(state, second, reply, member(), "demo", now);
  deleteConversation(state, second.chatId);
  assert.equal(state.activeId, null); assert.equal(state.conversations[0].id, first.chatId);
});
test("handoff only includes conversation after explicit opt-in", () => {
  const state = createCoachState(now), request = beginMessage(state, "My private question", member(), "demo", now);
  failMessage(state, request);
  assert.equal(buildHandoff(currentConversation(state), { note: "Please help" }, member()).transcript, "");
  const optedIn = buildHandoff(currentConversation(state), { note: "Please help", includeConversation: true, team: "consultant" }, member());
  assert.match(optedIn.transcript, /My private question/); assert.match(optedIn.transcript, /no reply received/);
  assert.equal(optedIn.team, "Your consultant");
  assert.equal(buildHandoff(null, { team: "consultant" }, createMember({ membership: "essentials" })).team, "Member support");
});
test("sample guidance uses goal/progress and only points to entitled lessons", () => {
  const answer = demoReply("What should I do next?", member(), goal);
  assert.equal(answer.lessonId, "blueprint"); assert.match(answer.text, /Grow with focus/);
  assert.equal(demoReply("My next lesson", createMember({ membership: "essentials" }), goal).lessonId, "rhythm");
  assert.equal(demoReply("Help with a payment", member(), goal).handoff, true);
  assert.match(demoReply("Give me investment advice", member(), goal).text, /qualified professional/);
});
test("corrupt and blocked storage leave a usable local conversation", () => {
  const local = storage(); local.setItem(COACH_KEY, "broken");
  assert.deepEqual(loadCoach(local, now), createCoachState(now));
  const denied = { getItem() { throw Error("blocked"); }, setItem() { throw Error("full"); } };
  assert.equal(saveCoach(createCoachState(now), denied), false);
  assert.deepEqual(loadCoach(denied, now), createCoachState(now));
});
test("restored state cannot introduce invalid IDs, duplicate messages or arbitrary lesson links", () => {
  const state = createCoachState(now); const request = beginMessage(state, "Hello", member(), "demo", now);
  resolveMessage(state, request, reply, member(), "demo", now);
  const conversation = currentConversation(state); conversation.messages[1].lessonId = "external-url";
  conversation.messages.push(conversation.messages[0]); state.used = 9999;
  state.conversations.push({ id: 'bad"id', messages: [] });
  const local = storage(); saveCoach(state, local); const restored = loadCoach(local, now);
  assert.equal(Object.hasOwn(restored, "used"), false); assert.equal(restored.conversations.length, 1);
  assert.equal(currentConversation(restored).messages.length, 2); assert.equal(currentConversation(restored).messages[1].lessonId, null);
});
test("new conversations remain available beyond the former history count cap", () => {
  const state = createCoachState(now);
  for (let i = 0; i < 35; i++) {
    state.activeId = null;
    const request = beginMessage(state, `Conversation ${i}`, member(), "demo", now);
    assert.equal(request.error, undefined);
    resolveMessage(state, request, reply, member(), "demo", now);
  }
  const local = storage(); saveCoach(state, local);
  const restored = loadCoach(local, now);
  assert.equal(restored.conversations.length, 35);
  restored.activeId = null;
  assert.equal(beginMessage(restored, "One more conversation", member(), "demo", now).error, undefined);
  assert.equal(restored.conversations.length, 36);
});
test("coach UI has no quota counter, exhaustion screen or allowance preview", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("./coach.js", import.meta.url), "utf8");
  const config = readFileSync(new URL("./coach-config.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /coach-usage|coach-limit|coach-demo-quota/);
  assert.doesNotMatch(js, /allowance\(|refreshAllowance|DAILY_ALLOWANCE|quotaTimer|coach-demo-quota|messages left today|usage charged/i);
  assert.doesNotMatch(config, /dailyAllowance/);
  assert.doesNotMatch(html, /coach-context-note/);
  assert.doesNotMatch(js, /coach-context-note|Unlimited prompts\. General guidance/);
});
