import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMember, getDashboard } from "./home-model.js";
import { requiresSession, safeReturnRoute } from "./profile-model.js";
import { EVENTS_KEY, createEventState, eventCatalogue, canAttend, relatedLessons, registrationFor, eventStatus, selectEvents, eventProgress, nextEvent, isEventDay, eventDate, eventTime, eventMonth, ticketLabel, registerEvent, cancelRegistration, simulateCheckIn, parseEventRoute, persistEvents, loadEvents } from "./events-model.js";
const now = Date.parse("2026-09-08T00:00:00Z");
const setup = membership => { const state = createEventState(now); return { state, member: createMember({ membership }), event: eventCatalogue(state).find(e => e.key === "focus") }; };
const store = () => { const data = new Map(); return { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) }; };

test("events are dated, sorted and stable across reloads", () => {
  const { state } = setup(); const storage = store(); persistEvents(state, storage);
  const events = eventCatalogue(loadEvents(storage, now + 86400000));
  assert.deepEqual(events, eventCatalogue(state));
  assert.equal(new Set(events.map(e => e.id)).size, events.length);
  assert.ok(events.every((e, i) => !i || e.start >= events[i - 1].start));
  assert.ok(events.some(e => e.format === "online")); assert.ok(events.some(e => e.format === "in-person"));
});
test("event lists contain only entitled events, including filters and Mine", () => {
  const { member, state, event } = setup("growth"); registerEvent(member, state, event, now);
  for (const membership of ["growth", "essentials", "paused", "payment"]) {
    member.membership = membership;
    for (const format of ["all", "online", "in-person"]) for (const mine of [true, false]) {
      const items = selectEvents(member, state, { format, mine, now });
      assert.ok(items.every(e => canAttend(member, e)));
      assert.ok(items.every(e => e.access !== "master"));
      if (format !== "all") assert.ok(items.every(e => e.format === format));
    }
  }
  member.membership = "essentials"; assert.equal(selectEvents(member, state, { mine: true, now }).length, 0);
});
test("one-tap registration is idempotent and creates only an upcoming commitment", () => {
  const { member, state, event } = setup(); const learning = structuredClone(member);
  assert.deepEqual(registerEvent(member, state, event, now), { ok: true, changed: true });
  const pass = registrationFor(state, event.id).passId;
  assert.deepEqual(registerEvent(member, state, event, now + 100), { ok: true, changed: false });
  assert.equal(registrationFor(state, event.id).passId, pass);
  assert.equal(eventProgress(member, state, now).upcoming.length, 1);
  assert.equal(eventProgress(member, state, now).attended.length, 0); assert.deepEqual(member, learning);
});
test("full, cancelled, ended and inaccessible events reject new registration", () => {
  const { member, state } = setup();
  for (const key of ["team", "weekly", "review", "strategy"]) {
    const event = eventCatalogue(state).find(e => e.key === key);
    assert.equal(registerEvent(member, state, event, now).ok, false);
    assert.equal(registrationFor(state, event.id), null);
  }
  assert.equal(eventStatus(member, undefined, state, now), "unavailable");
});
test("cancelling removes upcoming entry, invalidates pass and permits a new pass", () => {
  const { member, state, event } = setup(); registerEvent(member, state, event, now);
  const originalPass = registrationFor(state, event.id).passId;
  assert.equal(cancelRegistration(member, state, event).ok, true);
  assert.equal(registrationFor(state, event.id).passId, null);
  assert.equal(eventProgress(member, state, now).upcoming.length, 0);
  assert.equal(simulateCheckIn(member, state, event, now).ok, false);
  assert.equal(cancelRegistration(member, state, event).changed, false);
  registerEvent(member, state, event, now + 100);
  assert.notEqual(registrationFor(state, event.id).passId, originalPass);
});
test("simulated attendance is idempotent and never changes course metrics", () => {
  const { member, state, event } = setup(); const goal = { name: "Growth", success: "Focus" };
  const before = getDashboard(member, goal); registerEvent(member, state, event, now);
  assert.equal(simulateCheckIn(member, state, event, now).changed, true);
  assert.equal(simulateCheckIn(member, state, event, now + 100).changed, false);
  assert.equal(registrationFor(state, event.id).checkedInAt, now);
  assert.equal(eventProgress(member, state, now).upcoming.length, 0);
  assert.equal(eventProgress(member, state, now).attended.length, 1);
  assert.equal(cancelRegistration(member, state, event).ok, false);
  assert.deepEqual(getDashboard(member, goal), before);
});
test("membership changes recheck detail, ticket actions and cross-linked lessons", () => {
  const { member, state, event } = setup(); registerEvent(member, state, event, now); member.membership = "essentials";
  assert.equal(eventStatus(member, event, state, now), "unavailable");
  assert.equal(registerEvent(member, state, event, now).ok, false);
  assert.equal(simulateCheckIn(member, state, event, now).ok, false);
  assert.equal(cancelRegistration(member, state, event).ok, false);
  const online = eventCatalogue(state).find(e => e.key === "leadership");
  assert.deepEqual(relatedLessons(member, online).map(e => e.id), ["direction"]);
  member.membership = "payment"; assert.equal(eventStatus(member, event, state, now), "registered");
});
test("a cancelled or ended event never offers current ticket access", () => {
  const { member, state, event } = setup(); registerEvent(member, state, event, now);
  assert.equal(eventStatus(member, { ...event, status: "cancelled" }, state, now), "cancelled");
  assert.equal(eventStatus(member, event, state, event.end), "ended");
  assert.equal(simulateCheckIn(member, state, { ...event, status: "cancelled" }, now).ok, false);
  assert.equal(simulateCheckIn(member, state, event, event.end).ok, false);
});
test("Home prioritizes registered events, then earliest open entitled event", () => {
  const { member, state, event } = setup(); assert.equal(nextEvent(member, state, now).id, event.id);
  const online = eventCatalogue(state).find(e => e.key === "leadership"); registerEvent(member, state, online, now);
  assert.equal(nextEvent(member, state, now).id, online.id);
  assert.equal(ticketLabel(online), "View online access"); assert.equal(ticketLabel(event), "View my ticket");
  cancelRegistration(member, state, online); assert.equal(nextEvent(member, state, now).id, event.id);
  simulateCheckIn(member, state, online, now); assert.equal(eventProgress(member, state, now).attended.length, 0);
});
test("event date labels include venue time zones and daylight saving", () => {
  const { event } = setup();
  assert.match(eventDate(event), /10 Sept 2026/); assert.equal(eventMonth(event), "September 2026");
  assert.match(eventTime(event), /10:00 am AEST/);
  const daylight = { ...event, start: Date.parse("2026-10-10T00:00:00Z") };
  assert.match(eventTime(daylight), /11:00 am AEDT/);
  assert.equal(isEventDay(event, event.start + 1000), true); assert.equal(isEventDay(event, event.start - 86400000), false);
});
test("Events deep links are protected and preserve exact valid destinations", () => {
  for (const route of ["events", "events/mine", "events/focus-2026-09-08", "events/focus-2026-09-08/confirmed", "events/focus-2026-09-08/ticket", "events/focus-2026-09-08/checked-in"]) {
    assert.equal(requiresSession(route), true); assert.equal(safeReturnRoute(`#${route}`), route); assert.notEqual(parseEventRoute(route).view, "unavailable");
  }
  for (const route of ["events/mine/ticket", "events/../../outside", "events/focus-2026-09-08/ticket/extra", "events/focus-2026-09-08?next=evil", "events/%3Cscript%3E", "events//ticket"]) {
    assert.equal(parseEventRoute(route).view, "unavailable"); assert.equal(safeReturnRoute(route), "home");
  }
});
test("registrations and attendance persist without touching other app stores", () => {
  const { member, state, event } = setup(); const storage = store(); storage.setItem("master-app.learning.v1", "preserve");
  registerEvent(member, state, event, now); simulateCheckIn(member, state, event, now); assert.equal(persistEvents(state, storage), true);
  assert.deepEqual(loadEvents(storage, now), state); assert.equal(storage.getItem("master-app.learning.v1"), "preserve");
});
test("fresh sample dates preserve older attendance when the catalogue ages", () => {
  const { member, state, event } = setup(); const storage = store(); registerEvent(member, state, event, now); simulateCheckIn(member, state, event, now); persistEvents(state, storage);
  const later = now + 90 * 86400000, restored = loadEvents(storage, later);
  assert.equal(restored.anchors.length, 2); assert.equal(eventProgress(member, restored, later).attended.length, 1);
  assert.ok(selectEvents(member, restored, { now: later }).length > 0);
});
test("blocked or corrupt storage leaves a functional in-memory demo", () => {
  const blocked = { getItem() { throw Error("denied"); }, setItem() { throw Error("full"); } };
  assert.deepEqual(loadEvents(blocked, now), createEventState(now)); assert.equal(persistEvents(createEventState(now), blocked), false);
  const storage = store(); storage.setItem(EVENTS_KEY, "not json"); assert.deepEqual(loadEvents(storage, now), createEventState(now));
  for (const raw of [{ version: 1, anchors: ["2026-02-30"] }, { version: 1, anchors: [] }, { version: 2, anchors: ["2026-09-08"] }]) {
    storage.setItem(EVENTS_KEY, JSON.stringify(raw)); assert.deepEqual(loadEvents(storage, now), createEventState(now));
  }
});
test("restoration validates event IDs, states, timestamps and pass identifiers", () => {
  const { state, event } = setup(); const storage = store();
  state.registrations[event.id] = { status: "registered", revision: 1, registeredAt: now, passId: "<script>evil</script>", checkedInAt: 999 };
  state.registrations.evil = { status: "attended", revision: 1, registeredAt: now, checkedInAt: now };
  persistEvents(state, storage); const restored = loadEvents(storage, now);
  assert.equal(Object.keys(restored.registrations).length, 1); assert.match(registrationFor(restored, event.id).passId, /^DEMO-/);
  assert.equal(registrationFor(restored, event.id).checkedInAt, null);
  state.registrations[event.id].status = "attended"; state.registrations[event.id].checkedInAt = "bad";
  persistEvents(state, storage); assert.equal(Object.keys(loadEvents(storage, now).registrations).length, 0);
});
test("event demo has no live registration, wallet, notification or admission API", () => {
  const source = readFileSync(new URL("./events.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|Notification\(|serviceWorker\.register|PaymentRequest|requestPermission|\.pkpass/);
  assert.match(source, /Simulate staff check-in/); assert.match(source, /not valid for admission/);
  assert.match(source, /does not mark attendance/); assert.match(source, /No calendar item or reminder has been created/);
});
