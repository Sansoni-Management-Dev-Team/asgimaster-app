import test from "node:test";
import assert from "node:assert/strict";
import { createSupportState, startConversation, sendMessage, agentReply, markRead, resolveConversation, reopenConversation, findConversation, listConversations, unreadCount, supportLink, parseSupportRoute, validId, saveSupport, loadSupport, SUPPORT_KEY, MAX_CONVERSATIONS, MAX_MESSAGES } from "./support-model.js";
const now = new Date("2026-09-07T12:00:00Z");
const storage = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
const start = (state, text = "I can't open my lesson") => startConversation(state, { topic: "access", text }, {}, now).conversation;

test("support begins empty, with independent active and resolved history", () => {
  const state = createSupportState();
  assert.equal(listConversations(state).length, 0); assert.equal(listConversations(state, true).length, 0);
  const chat = start(state);
  assert.equal(chat.status, "waiting"); assert.equal(chat.messages.length, 1); assert.equal(chat.context, "");
  assert.equal(unreadCount(state), 0); assert.equal(listConversations(state)[0].id, chat.id);
});
test("new requests validate text, topic and consultant entitlement", () => {
  const state = createSupportState();
  for (const text of [" ", "x".repeat(2001)]) assert.ok(startConversation(state, { text }).error);
  assert.ok(startConversation(state, { topic: "__proto__", text: "help" }).error);
  assert.ok(startConversation(state, { topic: "consultant", text: "help" }).error);
  assert.ok(startConversation(state, { topic: "consultant", text: "help" }, { consultant: true }).conversation);
  assert.equal(state.conversations.length, 1);
});
test("agent replies create unread state and reading clears only that conversation", () => {
  const state = createSupportState(), first = start(state), second = start(state, "Another issue");
  agentReply(state, first.id); agentReply(state, second.id);
  assert.equal(first.status, "replied"); assert.equal(unreadCount(state), 2);
  markRead(state, first.id); assert.equal(unreadCount(state), 1); assert.equal(second.unread, true);
  assert.equal(markRead(state, "unknown"), false);
});
test("client follow-up returns a request to waiting without erasing messages", () => {
  const state = createSupportState(), chat = start(state);
  agentReply(state, chat.id);
  sendMessage(state, chat.id, "It is the blueprint lesson", now);
  assert.equal(chat.status, "waiting"); assert.equal(chat.unread, false); assert.equal(chat.messages.length, 3);
  assert.equal(chat.messages[1].role, "agent");
});
test("resolution is idempotent, moves to history and blocks new replies", () => {
  const state = createSupportState(), chat = start(state);
  assert.equal(resolveConversation(state, chat.id, now), true);
  assert.equal(resolveConversation(state, chat.id, now), false);
  assert.equal(listConversations(state).length, 0); assert.equal(listConversations(state, true).length, 1);
  assert.ok(sendMessage(state, chat.id, "Another").error); assert.ok(agentReply(state, chat.id).error);
  assert.equal(chat.messages.length, 2);
});
test("agent can resolve, and client can reopen the same request with its history", () => {
  const state = createSupportState(), chat = start(state);
  const result = agentReply(state, chat.id, { resolve: true }, now);
  assert.equal(result.conversation.status, "resolved"); assert.equal(chat.unread, true);
  assert.equal(result.message.role, "agent");
  assert.equal(reopenConversation(state, chat.id, now), true);
  assert.equal(reopenConversation(state, chat.id, now), false);
  assert.equal(chat.status, "waiting"); assert.equal(chat.messages.length, 3); assert.equal(chat.unread, false);
});
test("deep links target only a validated conversation ID, never message text", () => {
  const state = createSupportState(), chat = start(state);
  assert.deepEqual(parseSupportRoute(supportLink(chat.id)), { view: "conversation", id: chat.id });
  assert.equal(supportLink('bad"<script>'), "#support");
  for (const bad of ["#support/../../etc", "#support/%3Cscript%3E", "#support/a?token=secret", "#support/a/b", "#other/a", "#support/"]) assert.equal(parseSupportRoute(bad).view, "missing");
  assert.deepEqual(parseSupportRoute("#support/history"), { view: "history" });
  assert.deepEqual(parseSupportRoute("#support/new"), { view: "new" });
  assert.deepEqual(parseSupportRoute("#support"), { view: "current" });
  assert.equal(findConversation(state, "unknown"), undefined); assert.equal(validId("new"), false);
});
test("direct link and notification unread state survive reload independently for multiple requests", () => {
  const state = createSupportState(), first = start(state), second = start(state, "Different issue");
  agentReply(state, first.id); resolveConversation(state, second.id);
  const local = storage(); saveSupport(state, local); const restored = loadSupport(local);
  const route = parseSupportRoute(supportLink(first.id));
  assert.equal(findConversation(restored, route.id).messages[1].role, "agent");
  assert.equal(findConversation(restored, route.id).unread, true);
  assert.equal(listConversations(restored, true)[0].id, second.id);
});
test("handoff preserves only the explicitly supplied transcript, without alteration", () => {
  const state = createSupportState(), transcript = "You: I need help\n\nAaronAI (demo): Ask support.";
  const without = startConversation(state, { text: "Help me" }).conversation;
  const withContext = startConversation(state, { text: "Help me", context: transcript }).conversation;
  assert.equal(without.context, ""); assert.equal(withContext.context, transcript);
  assert.ok(startConversation(state, { text: "Help", context: "x".repeat(600001) }).error);
  const local = storage(); saveSupport(state, local); assert.equal(findConversation(loadSupport(local), withContext.id).context, transcript);
});
test("failed validation and unknown conversation do not modify or duplicate requests", () => {
  const state = createSupportState(), chat = start(state);
  for (const text of ["", " ", "x".repeat(2001)]) assert.ok(sendMessage(state, chat.id, text).error);
  assert.ok(sendMessage(state, "missing", "help").error); assert.ok(agentReply(state, "missing").error);
  assert.equal(chat.messages.length, 1); assert.equal(state.conversations.length, 1);
});
test("history capacity never silently deletes an existing request", () => {
  const state = createSupportState();
  for (let n = 0; n < MAX_CONVERSATIONS; n++) start(state, `Question ${n}`);
  const ids = state.conversations.map(chat => chat.id);
  assert.ok(startConversation(state, { text: "one more" }).error);
  assert.deepEqual(state.conversations.map(chat => chat.id), ids);
});
test("conversation capacity reserves room for an agent response and resolution", () => {
  const state = createSupportState(), chat = start(state);
  chat.messages = Array.from({ length: MAX_MESSAGES - 3 }, (_, i) => ({ id: `message-${i}`, role: "user", text: "Question", createdAt: now.toISOString() }));
  assert.ok(sendMessage(state, chat.id, "one more").error);
  assert.ok(agentReply(state, chat.id).message);
  assert.equal(resolveConversation(state, chat.id), true);
  assert.equal(chat.messages.length <= MAX_MESSAGES, true);
});
test("invalid or inaccessible storage preserves a usable in-memory prototype", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); } };
  assert.equal(loadSupport(broken).conversations.length, 0); assert.equal(saveSupport(createSupportState(), broken), false);
  const local = storage(); local.setItem(SUPPORT_KEY, "invalid json"); assert.equal(loadSupport(local).conversations.length, 0);
  local.setItem(SUPPORT_KEY, JSON.stringify({ version: 2, conversations: [] })); assert.equal(loadSupport(local).conversations.length, 0);
});
test("stored data cannot introduce invalid IDs, roles, duplicated messages or unknown states", () => {
  const state = createSupportState(), chat = start(state); const local = storage();
  chat.messages.push({ ...chat.messages[0] }, { id: "bad<id", role: "user", text: "no", createdAt: "bad" }, { id: "msg-2", role: "administrator", text: "no", createdAt: now.toISOString() });
  state.conversations.push({ ...chat }, { ...chat, id: "unknown-topic", topic: "constructor" }, { ...chat, id: "invalid-status", status: "sent" });
  saveSupport(state, local); const restored = loadSupport(local, now);
  assert.equal(restored.conversations.length, 1); assert.equal(restored.conversations[0].messages.length, 1);
});
