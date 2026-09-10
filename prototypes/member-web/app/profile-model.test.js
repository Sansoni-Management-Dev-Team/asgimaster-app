import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMember, membershipFor, lessons, canWatch } from "./home-model.js";
import { profileConfig } from "./profile-config.js";
import { saveReturnRoute, loadReturnRoute, RETURN_KEY } from "./profile-model.js";
import { createProfile, validateDetails, updateDetails, identity, setNotifications, optOut, canNotify, resolvedMembership, externalDestination, createSessions, signOutSession, signInSession, revokeSession, revokeOtherSessions, addDemoSession, requiresSession, safeReturnRoute, persistProfile, persistSessions, loadProfile, loadSessions, PROFILE_KEY, SESSION_KEY } from "./profile-model.js";
const storage = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
const goal = { name: "Grow with focus", weeks: "12" };

test("sign-in return destination survives reload and cannot become an external redirect", () => {
  const saved = storage();
  assert.equal(saveReturnRoute("support/demo-conversation", saved), true);
  assert.equal(loadReturnRoute(saved), "support/demo-conversation");
  saved.setItem(RETURN_KEY, "https://untrusted.example"); assert.equal(loadReturnRoute(saved), "home");
  saveReturnRoute(null, saved); assert.equal(loadReturnRoute(saved), null);
  assert.equal(saveReturnRoute("home", null), false); assert.equal(loadReturnRoute(null), null);
});

test("profile defaults are clearly sample identity with optional channels off", () => {
  const state = createProfile(); assert.equal(identity(state).fullName, "Shan Yang"); assert.equal(identity(state).initials, "SY");
  assert.equal(canNotify(state, "support", "push"), false); assert.equal(canNotify(state, "learning", "email"), false);
  assert.equal(profileConfig.demoEmail, "shan@example.com");
});

test("editable initials are escaped in both Home and membership preview markup", () => {
  const source = readFileSync(new URL("./home.js", import.meta.url), "utf8");
  assert.equal(source.includes("${member.initials}"), false);
  assert.equal(source.match(/\$\{escape\(member\.initials\)\}/g).length, 2);
});
test("profile validation supports Unicode, optional names and bounded fields", () => {
  const state = createProfile();
  assert.equal(updateDetails(state, { firstName: "  山 ", lastName: "杨", company: "  示例  ", timezone: "Australia/Sydney" }).valid, true);
  assert.equal(identity(state).initials, "山杨"); assert.equal(state.details.company, "示例");
  assert.equal(validateDetails({ firstName: "A", lastName: "", company: "", timezone: "UTC" }).valid, true);
  for (const changes of [{ firstName: " " }, { firstName: "x".repeat(61) }, { lastName: "x".repeat(61) }, { company: "x".repeat(101) }, { timezone: "constructor" }]) assert.equal(validateDetails({ ...state.details, ...changes }).valid, false);
});
test("invalid details leave the saved profile unchanged", () => {
  const state = createProfile(), original = { ...state.details };
  assert.equal(updateDetails(state, { ...state.details, firstName: "" }).valid, false); assert.deepEqual(state.details, original);
});
test("editable fields cannot overwrite identity IDs, email or membership claims", () => {
  const state = createProfile();
  updateDetails(state, { ...state.details, firstName: "Sam", email: "another@example.com", membership: "growth", memberId: "admin", ai: true });
  assert.equal(state.details.firstName, "Sam"); assert.equal(state.details.email, undefined); assert.equal(state.details.membership, undefined); assert.equal(state.details.memberId, undefined);
});
test("notification delivery requires both a channel and a topic", () => {
  const state = createProfile(); setNotifications(state, { push: true, email: false, support: true, learning: false, programme: false });
  assert.equal(canNotify(state, "support", "push"), true); assert.equal(canNotify(state, "support", "email"), false); assert.equal(canNotify(state, "learning", "push"), false); assert.equal(canNotify(state, "security", "push"), false);
});
test("opt-out disables all optional topics and channels and survives reload", () => {
  const state = createProfile(), local = storage(); setNotifications(state, { push: true, email: true, support: true, learning: true, programme: true }); optOut(state); persistProfile(state, local);
  assert.equal(Object.values(loadProfile(local).notifications).some(Boolean), false);
});
test("malformed preference values cannot opt a member in", () => {
  const state = createProfile(); setNotifications(state, { push: "true", email: 1, support: "yes" });
  assert.equal(Object.values(state.notifications).some(Boolean), false);
});
test("resolved access matches Home and Library for every sample membership", () => {
  for (const membership of ["growth", "essentials", "payment", "paused"]) {
    const member = createMember({ membership }), resolved = resolvedMembership(member, goal), access = membershipFor(member);
    assert.equal(resolved.lessons, lessons.filter(lesson => canWatch(member, lesson)).length); assert.equal(resolved.ai, access.ai); assert.equal(resolved.consultant, access.coach); assert.equal(resolved.support, true); assert.equal(resolved.weeks, "12");
  }
});
test("billing states show demo renewal, payment attention and paused renewal separately", () => {
  assert.equal(resolvedMembership(createMember(), goal).renewal, "2026-10-07");
  assert.equal(resolvedMembership(createMember({ membership: "payment" }), goal).payment, "Needs attention");
  assert.equal(resolvedMembership(createMember({ membership: "paused" }), goal).renewal, null);
});
test("external destinations require supplied HTTPS URLs on exact approved origins", () => {
  const config = { allowedOrigins: ["https://billing.example.test"], url: "https://billing.example.test/customer/manage" };
  assert.equal(externalDestination(config).href, config.url);
  for (const url of [null, "javascript:alert(1)", "http://billing.example.test", "https://billing.example.test.evil.test", "https://billing.example.test@evil.test", "https://user:password@billing.example.test", "/payment"]) assert.equal(externalDestination({ ...config, url }), null);
  assert.equal(externalDestination({ url: config.url, allowedOrigins: [] }), null);
});
test("unconfigured Maxio and legal destinations fail closed", () => {
  for (const key of ["maxio", "privacy", "terms"]) assert.equal(externalDestination(profileConfig[key]), null);
});
test("session controls distinguish this browser, other devices and all sessions", () => {
  const current = createSessions(); assert.equal(current.others.length, 0); addDemoSession(current); assert.equal(addDemoSession(current), false);
  assert.equal(revokeSession(current, "current"), false); assert.equal(revokeSession(current, "unknown"), false);
  assert.equal(revokeSession(current, "demo-tablet"), true); assert.equal(current.signedIn, true);
  addDemoSession(current); signOutSession(current); assert.equal(current.signedIn, false); assert.equal(current.others.length, 1);
  signInSession(current); revokeOtherSessions(current); assert.equal(current.signedIn, true); assert.equal(current.others.length, 0);
  addDemoSession(current); signOutSession(current, true); assert.equal(current.signedIn, false); assert.equal(current.others.length, 0);
});
test("sign-out persists across reload, and corrupt session storage fails closed", () => {
  const local = storage(), state = createSessions(); signOutSession(state); persistSessions(state, local); assert.equal(loadSessions(local).signedIn, false);
  local.setItem(SESSION_KEY, "invalid"); assert.equal(loadSessions(local).signedIn, false);
  local.setItem(SESSION_KEY, JSON.stringify({ version: 1, signedIn: "true" })); assert.equal(loadSessions(local).signedIn, false);
});
test("all member routes require a session and return destinations reject external redirects", () => {
  for (const route of ["#profile", "profile/membership", "support/abc-123", "player/blueprint", "home", "plan", "adjust-goal", "library", "coach"]) assert.equal(requiresSession(route), true);
  for (const route of ["signin", "sent", "invite"]) assert.equal(requiresSession(route), false);
  assert.equal(safeReturnRoute("#support/abc-123"), "support/abc-123");
  for (const route of ["https://evil.test", "//evil.test", "support/../../outside", "profile?next=https://evil.test", "javascript:alert(1)", "signin"]) assert.equal(safeReturnRoute(route), "home");
});
test("profile persistence validates stored values without erasing independent app state", () => {
  const local = storage(), state = createProfile(); updateDetails(state, { ...state.details, firstName: "Sam" }); persistProfile(state, local);
  assert.equal(loadProfile(local).details.firstName, "Sam"); assert.equal(local.getItem(SESSION_KEY), undefined);
  local.setItem(PROFILE_KEY, JSON.stringify({ version: 1, details: { firstName: "Admin", timezone: "invalid" }, notifications: { push: "true", support: true } }));
  assert.equal(loadProfile(local).details.firstName, "Shan"); assert.equal(canNotify(loadProfile(local), "support"), false);
});
test("blocked storage keeps edits usable but never invents a signed-in session", () => {
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); } };
  const state = loadProfile(blocked); assert.equal(updateDetails(state, { ...state.details, firstName: "Sam" }).valid, true);
  assert.equal(persistProfile(state, blocked), false); assert.equal(loadSessions(blocked).signedIn, false); assert.equal(persistSessions(createSessions(), blocked), false);
});
test("profile payment UI contains no card form, embedded checkout or payment API", () => {
  const source = readFileSync(new URL("./profile.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /<iframe|<input[^>]+(?:cc-number|cc-csc|card-number)|Stripe\(|chargify\.|fetch\(/i);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/); assert.match(source, /externalDestination\(profileConfig\[kind\]\)/);
});
