import test from "node:test";
import assert from "node:assert/strict";
import { createPlayerPresentation } from "./player-presentation.js";

function fixture(t, { pending = false } = {}) {
  const events = new Map(), classes = new Set(), attributes = new Map(), styles = new Map();
  const calls = { request: 0, exit: 0, lock: 0, unlock: 0, focus: 0 };
  const control = { setAttribute: (key, value) => attributes.set(key, value), focus: () => { calls.focus++; }, isConnected: true };
  let grant;
  const doc = { fullscreenEnabled: true, fullscreenElement: null, addEventListener: (name, callback) => events.set(name, callback), exitFullscreen: async () => { calls.exit++; doc.fullscreenElement = null; } };
  const media = {
    parentElement: null,
    classList: { add: (...values) => values.forEach(value => classes.add(value)), remove: (...values) => values.forEach(value => classes.delete(value)), toggle: (value, on) => on ? classes.add(value) : classes.delete(value) },
    style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) },
    getBoundingClientRect: () => ({ width: 390, height: 844 }), querySelector: () => control,
    requestFullscreen: () => { calls.request++; if (pending) return new Promise(resolve => { grant = () => { doc.fullscreenElement = media; resolve(); }; }); doc.fullscreenElement = media; return Promise.resolve(); },
  };
  const browserScreen = { orientation: { lock: async () => { calls.lock++; throw new Error("Orientation unsupported"); }, unlock: () => { calls.unlock++; }, addEventListener() {} } };
  for (const [name, value] of Object.entries({ document: doc, window: { addEventListener() {} }, screen: browserScreen })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
  }
  const controller = createPlayerPresentation({ getMedia: () => media, getVideo: () => ({ paused: true }), announce() {} });
  return { controller, doc, calls, classes, attributes, styles, events, grant: () => grant() };
}

test("unsupported device orientation still gets a landscape stage and releases orientation on exit", async t => {
  const f = fixture(t);
  await f.controller.enter();
  assert.equal(f.controller.isExpanded(), true); assert.equal(f.classes.has("is-rotated"), true);
  assert.equal(f.styles.get("--player-stage-width"), "844px"); assert.equal(f.styles.get("--player-stage-height"), "390px");
  assert.equal(f.attributes.get("aria-label"), "Exit full screen"); assert.equal(f.calls.lock, 1);
  await f.controller.exit();
  assert.equal(f.controller.isExpanded(), false); assert.equal(f.classes.size, 0); assert.equal(f.styles.size, 0);
  assert.equal(f.attributes.get("aria-label"), "Full screen"); assert.equal(f.calls.unlock, 1); assert.equal(f.calls.exit, 1);
});

test("repeat taps and late browser fullscreen grants cannot reopen a player after navigation", async t => {
  const f = fixture(t, { pending: true });
  const entering = f.controller.enter(); await f.controller.enter(); assert.equal(f.calls.request, 1);
  await f.controller.leave(); f.grant(); await entering;
  assert.equal(f.doc.fullscreenElement, null); assert.equal(f.controller.isExpanded(), false);
  assert.equal(f.classes.size, 0); assert.equal(f.calls.lock, 0); assert.equal(f.calls.focus, 0);
});

test("browser-initiated fullscreen exit restores the inline control and clears stage sizing", async t => {
  const f = fixture(t); await f.controller.enter();
  f.doc.fullscreenElement = null; f.events.get("fullscreenchange")();
  assert.equal(f.controller.isExpanded(), false); assert.equal(f.attributes.get("title"), "Full screen");
  assert.equal(f.classes.size, 0); assert.equal(f.styles.size, 0); assert.equal(f.calls.unlock, 1);
});
