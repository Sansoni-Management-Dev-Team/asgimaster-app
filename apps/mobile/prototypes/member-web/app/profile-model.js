import { membershipFor, lessons, canWatch } from "./home-model.js";
import { profileConfig } from "./profile-config.js";
import { parseEventRoute } from "./events-model.js";

export const PROFILE_KEY = "master-app.profile.v1";
export const SESSION_KEY = "master-app.session.v1";
export const RETURN_KEY = "master-app.return.v1";
export const timezones = Object.freeze({ "Australia/Sydney": "Sydney", "Australia/Perth": "Perth", "Pacific/Auckland": "Auckland", "Asia/Singapore": "Singapore", "Europe/London": "London", "America/New_York": "New York", UTC: "UTC" });
export const notificationKeys = ["push", "email", "support", "learning", "programme"];
export const protectedPages = ["onboarding", "plan", "adjust-goal", "home", "library", "player", "coach", "support", "profile", "events"];
export function createProfile() {
  return { version: 1, details: { firstName: "Shan", lastName: "Yang", company: "", timezone: "Australia/Sydney" }, notifications: { push: false, email: false, support: true, learning: true, programme: false } };
}
export function validateDetails(input) {
  const details = { firstName: String(input.firstName || "").trim(), lastName: String(input.lastName || "").trim(), company: String(input.company || "").trim(), timezone: input.timezone };
  const errors = {};
  if (!details.firstName || details.firstName.length > 60) errors.firstName = "Enter a first name of 1–60 characters.";
  if (details.lastName.length > 60) errors.lastName = "Keep your last name to 60 characters or fewer.";
  if (details.company.length > 100) errors.company = "Keep your business name to 100 characters or fewer.";
  if (!Object.hasOwn(timezones, details.timezone)) errors.timezone = "Choose a listed time zone.";
  return { details, errors, valid: !Object.keys(errors).length };
}
export function updateDetails(state, input) {
  const result = validateDetails(input);
  if (result.valid) state.details = result.details;
  return result;
}
export function identity(state) {
  const { firstName, lastName } = state.details;
  return { firstName, fullName: [firstName, lastName].filter(Boolean).join(" "), initials: [firstName, lastName].filter(Boolean).map(word => Array.from(word)[0]).join("").toLocaleUpperCase() };
}
export function setNotifications(state, input) {
  state.notifications = Object.fromEntries(notificationKeys.map(key => [key, input[key] === true]));
}
export const optOut = state => setNotifications(state, {});
export const canNotify = (state, topic, channel = "push") => ["push", "email"].includes(channel) && ["support", "learning", "programme"].includes(topic) && state.notifications[channel] === true && state.notifications[topic] === true;
export function resolvedMembership(member, goal) {
  const membership = membershipFor(member), entitled = lessons.filter(lesson => canWatch(member, lesson));
  return { name: membership.name, status: membership.status, goal: goal.name, weeks: goal.weeks,
    payment: membership.status === "payment_due" ? "Needs attention" : membership.status === "paused" ? "Membership paused" : "Up to date",
    renewal: membership.status === "paused" ? null : profileConfig.demoRenewalDate,
    lessons: entitled.length, collections: [...new Set(entitled.map(lesson => lesson.course))], ai: membership.ai, consultant: membership.coach, support: true };
}
export function externalDestination(config) {
  try {
    if (!config?.url || !Array.isArray(config.allowedOrigins)) return null;
    const url = new URL(config.url);
    if (url.protocol !== "https:" || url.username || url.password || !config.allowedOrigins.includes(url.origin)) return null;
    return { href: url.href, host: url.hostname };
  } catch { return null; }
}
export function createSessions(signedIn = true) { return { version: 1, signedIn, others: [] }; }
export function signOutSession(state, all = false) { state.signedIn = false; if (all) state.others = []; }
export function signInSession(state) { state.signedIn = true; }
export function revokeSession(state, id) {
  if (!state.signedIn || id === "current") return false;
  const index = state.others.findIndex(item => item.id === id);
  if (index < 0) return false;
  state.others.splice(index, 1); return true;
}
export function revokeOtherSessions(state) { if (!state.signedIn) return false; state.others = []; return true; }
export function addDemoSession(state) {
  if (!state.signedIn || state.others.length) return false;
  state.others.push({ id: "demo-tablet", label: "Demo tablet", detail: "Sample session · Not a real device" }); return true;
}
export const requiresSession = hash => protectedPages.includes(String(hash).replace(/^#/, "").split("/")[0]);
export function safeReturnRoute(route) {
  const value = String(route || "").replace(/^#/, "");
  if (value === "events" || value.startsWith("events/")) return parseEventRoute(value).view === "unavailable" ? "home" : value;
  return requiresSession(value) && /^[a-z-]+(?:\/[\w-]{1,100})?$/.test(value) ? value : "home";
}
function storage() { try { return globalThis.localStorage; } catch { return null; } }
function tabStorage() { try { return globalThis.sessionStorage; } catch { return null; } }
export function saveReturnRoute(route, target = tabStorage()) {
  try { if (!target) return false; target.setItem(RETURN_KEY, route ? safeReturnRoute(route) : ""); return true; } catch { return false; }
}
export function loadReturnRoute(target = tabStorage()) {
  try { const route = target?.getItem(RETURN_KEY); return route ? safeReturnRoute(route) : null; } catch { return null; }
}
export function persistProfile(state, target = storage()) { try { if (!target) return false; target.setItem(PROFILE_KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function persistSessions(state, target = storage()) { try { if (!target) return false; target.setItem(SESSION_KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function loadProfile(target = storage()) {
  const state = createProfile();
  try {
    const raw = JSON.parse(target?.getItem(PROFILE_KEY) || "null");
    if (raw?.version !== 1) return state;
    if (raw.details) updateDetails(state, raw.details);
    // Fail closed on malformed preferences instead of opting a member in.
    setNotifications(state, raw.notifications || {});
  } catch { /* The demo remains editable with corrupt or denied storage. */ }
  return state;
}
export function loadSessions(target = storage()) {
  try {
    if (!target) return createSessions(false);
    const value = target.getItem(SESSION_KEY);
    if (!value) return createSessions(); // Preserve the existing signed-in prototype on first use.
    const raw = JSON.parse(value);
    if (raw?.version !== 1 || typeof raw.signedIn !== "boolean") return createSessions(false);
    const state = createSessions(raw.signedIn);
    // Only explicitly labelled demo devices are accepted, never arbitrary stored identity claims.
    if (Array.isArray(raw.others) && raw.others.some(item => item?.id === "demo-tablet")) state.others = [{ id: "demo-tablet", label: "Demo tablet", detail: "Sample session · Not a real device" }];
    return state;
  } catch { return createSessions(false); }
}
