import { profileConfig } from "./profile-config.js";
import { loadProfile, loadSessions, persistProfile, persistSessions, identity, updateDetails, timezones, setNotifications, optOut, canNotify, resolvedMembership, externalDestination, signOutSession, signInSession, revokeSession, revokeOtherSessions, addDemoSession, SESSION_KEY } from "./profile-model.js";

const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (label, action, secondary = false, extra = "") => `<button class="profile-action ${secondary ? "text-button" : "ds-button ds-button--solid app-button"}" type="button" data-profile-action="${action}" ${extra}>${escape(label)}</button>`;
const row = (title, description, action, extra = "") => `<button class="profile-row" type="button" data-profile-action="${action}" ${extra}><span><strong>${escape(title)}</strong><span>${escape(description)}</span></span><span aria-hidden="true">${["privacy", "terms"].includes(action) ? "↗" : "›"}</span></button>`;
const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const prefs = [
  ["push", "Push notifications", "Optional alerts on your device. Device permission and live delivery are not connected."],
  ["email", "Email notifications", "Optional updates by email. This demo never sends email."],
  ["support", "Support replies", "Know when your support team has replied."],
  ["learning", "Learning reminders", "A nudge to pick up your included lessons."],
  ["programme", "Programme updates", "Optional news about your current programme."],
];

export function createProfileScreen({ getMember, getGoal, navigate, openSheet, closeSheet, openDemoMembership, onIdentityChange, onPreferencesChange, onSignOut }) {
  const state = loadProfile();
  let sessions = loadSessions(), active = false, page = "overview", detailDraft = null, notificationDraft = null, stored = true;
  const view = document.querySelector("#profile-view"), body = document.querySelector("#profile-body"), footer = document.querySelector("#profile-actions");
  const announcement = document.querySelector("#profile-announcement"), dialog = document.querySelector("#home-dialog");
  const announce = message => { (dialog.open ? document.querySelector("#sheet-announcement") : announcement).textContent = message; };
  const membership = () => resolvedMembership(getMember(), getGoal());
  function save() {
    stored = persistProfile(state);
    document.querySelector("#profile-storage").textContent = stored ? "Demo account · Changes saved on this browser only." : "Browser storage unavailable. Changes last for this visit only.";
    return stored ? "Saved on this browser only." : "Kept for this visit only; browser storage is unavailable.";
  }
  function saveSessions() {
    return persistSessions(sessions) ? "Demo session state saved on this browser." : "Browser storage is unavailable. This session change lasts for this visit only.";
  }
  function overview() {
    const person = identity(state), access = membership();
    const notifications = state.notifications.push || state.notifications.email;
    return `<section class="profile-identity"><span class="profile-avatar" aria-hidden="true">${escape(person.initials)}</span><p class="ds-eyebrow">Demo member · ${profileConfig.demoMemberId}</p><h2>${escape(person.fullName)}</h2><p>${escape(profileConfig.demoEmail)}</p>${state.details.company ? `<p>${escape(state.details.company)}</p>` : ""}</section>
      <button class="profile-plan ds-card" type="button" data-profile-action="membership"><span class="ds-eyebrow">Membership</span><strong>${escape(access.name)}</strong><span>${access.lessons} included lessons · ${access.status === "payment_due" ? "Payment needs attention" : access.status === "paused" ? "Limited access" : "Active"}</span><span class="profile-plan-arrow" aria-hidden="true">›</span></button>
      <section class="profile-section" aria-labelledby="profile-account-heading"><h3 id="profile-account-heading">Your account</h3><div class="profile-rows">${row("Member details", "Name, business and time zone", "details")}${row("Notifications", notifications ? "Manage channels and reminders" : "Optional notifications are off", "notifications")}${row("Sessions", `${1 + sessions.others.length} demo session${sessions.others.length ? "s" : ""} · Manage sign-ins`, "sessions")}</div></section>
      <section class="profile-section" aria-labelledby="profile-legal-heading"><h3 id="profile-legal-heading">Legal & help</h3><div class="profile-rows">${row("Privacy Policy", externalDestination(profileConfig.privacy) ? "Open published policy ↗" : "Published link not connected", "privacy")}${row("Terms of Service", externalDestination(profileConfig.terms) ? "Open published terms ↗" : "Published link not connected", "terms")}${row("Member support", "Talk to your team", "support")}</div></section>${button("Sign out", "signout", true)}`;
  }
  function details() {
    const person = state.details;
    return `<section class="profile-intro"><p class="ds-eyebrow">Member details</p><h2>Your details</h2><p>A little about you, kept in one place.</p></section><dl class="profile-facts"><div><dt>Member ID</dt><dd>${profileConfig.demoMemberId} · Demo</dd></div><div><dt>First name</dt><dd>${escape(person.firstName)}</dd></div><div><dt>Last name</dt><dd>${escape(person.lastName || "Not added")}</dd></div><div><dt>Business</dt><dd>${escape(person.company || "Not added")}</dd></div><div><dt>Time zone</dt><dd>${escape(timezones[person.timezone])} · ${escape(person.timezone)}</dd></div><div><dt>Sign-in email</dt><dd>${escape(profileConfig.demoEmail)}</dd></div></dl><p class="profile-note">This is a sample account. Email changes go through support; editing your profile doesn't change sign-in access or membership.</p>${button("Ask about an email change", "support", true)}`;
  }
  function editor() {
    const values = detailDraft || state.details;
    const field = (key, label, autocomplete, max, required = false) => `<div class="ds-field"><label class="ds-field__label" for="profile-${key}">${label}${required ? " (required)" : " (optional)"}</label><input class="ds-input" id="profile-${key}" name="${key}" autocomplete="${autocomplete}" maxlength="${max}" ${required ? "required" : ""} value="${escape(values[key])}" aria-describedby="profile-${key}-error"/><p class="ds-field__error" id="profile-${key}-error" role="alert" hidden></p></div>`;
    return `<section class="profile-intro"><p class="ds-eyebrow">Make it yours</p><h2>Edit profile</h2><p>Changes stay on this browser in the demo. Use sample details.</p></section><form id="profile-edit-form" class="profile-form" novalidate>${field("firstName", "First name", "given-name", 60, true)}${field("lastName", "Last name", "family-name", 60)}${field("company", "Business name", "organization", 100)}<div class="ds-field"><label class="ds-field__label" for="profile-timezone">Time zone</label><select class="ds-input" id="profile-timezone" aria-describedby="profile-timezone-error">${Object.entries(timezones).map(([key, label]) => `<option value="${key}" ${values.timezone === key ? "selected" : ""}>${label}</option>`).join("")}</select><p class="ds-field__error" id="profile-timezone-error" role="alert" hidden></p></div></form>`;
  }
  function notifications() {
    const values = notificationDraft || state.notifications;
    const toggle = ([key, label, hint]) => `<label class="profile-toggle" for="profile-pref-${key}"><span><strong id="profile-pref-${key}-label">${label}</strong><span id="profile-pref-${key}-hint">${hint}</span></span><input type="checkbox" role="switch" id="profile-pref-${key}" ${values[key] ? "checked" : ""} aria-labelledby="profile-pref-${key}-label" aria-describedby="profile-pref-${key}-hint"/></label>`;
    return `<section class="profile-intro"><p class="ds-eyebrow">On your terms</p><h2>Stay in<br>the loop.</h2><p>Choose how you'd like to hear from us. Save to apply your choices.</p></section><div class="profile-notification-group"><h3>Channels</h3>${prefs.slice(0, 2).map(toggle).join("")}</div><div class="profile-notification-group"><h3>What you hear</h3>${prefs.slice(2).map(toggle).join("")}</div><p class="profile-note">A channel and a topic must both be on. These settings control optional demo notifications, including the Support push preview. No device permission is requested or provider subscription changed.</p><p class="profile-note">Sign-in and essential account messages are managed separately by the live service. This prototype sends none.</p>`;
  }
  function membershipMarkup() {
    const item = membership();
    return `<section class="profile-intro"><p class="ds-eyebrow">Membership · Demo data</p><h2>${escape(item.name)}</h2><span class="profile-status">${item.status === "payment_due" ? "! Payment needs attention" : item.status === "paused" ? "Membership paused" : "✓ Membership active"}</span></section>
      <section class="profile-program ds-card"><p class="ds-eyebrow">Your current programme</p><h3>${escape(item.goal)}</h3><p><span class="ds-number">${escape(item.weeks)}</span> weeks · From your consultation</p>${button("View my plan", "plan", true)}</section>
      <dl class="profile-facts"><div><dt>Renewal date</dt><dd>${item.renewal ? `${date(item.renewal)}<span class="profile-fact-note">Sample date · Not live billing data</span>` : 'Not scheduled<span class="profile-fact-note">Paused demo membership</span>'}</dd></div><div><dt>Payment status</dt><dd>${item.status === "payment_due" ? "! " : ""}${escape(item.payment)}<span class="profile-fact-note">Demo status</span></dd></div></dl>
      <section class="profile-section"><h3>Your access</h3><p class="profile-note">Resolved from the same membership rules used by Home and Library.</p><ul class="profile-entitlements"><li><span aria-hidden="true">✓</span><span><strong>${item.lessons} included lessons</strong><span>${item.collections.map(escape).join(" · ")}</span></span></li><li><span aria-hidden="true">${item.ai ? "✓" : "—"}</span><span><strong>AaronAI coach</strong><span>${item.ai ? "Included · Demo availability applies" : "Not included in current access"}</span></span></li><li><span aria-hidden="true">${item.consultant ? "✓" : "—"}</span><span><strong>Consultant support</strong><span>${item.consultant ? "Included" : "Not included in current access"}</span></span></li><li><span aria-hidden="true">✓</span><span><strong>Member support</strong><span>Included, including paused memberships</span></span></li></ul></section>
      <aside class="profile-payment-boundary"><strong>Payments stay in Maxio.</strong><p>Payment management opens outside Master App. This app doesn't accept payments or collect card information.</p>${!externalDestination(profileConfig.maxio) ? '<p>Existing Maxio destination not connected yet.</p>' : ""}</aside>`;
  }
  function sessionsMarkup() {
    return `<section class="profile-intro"><p class="ds-eyebrow">Session management</p><h2>Your sign-ins</h2><p>Manage this demo session and any sample devices.</p></section><div class="profile-session ds-card"><span class="profile-status">Current session</span><h3>This browser</h3><p>Active demo session · No live authentication token</p></div>${sessions.others.map(item => `<div class="profile-session ds-card"><h3>${escape(item.label)}</h3><p>${escape(item.detail)}</p>${button("End sample session", "revoke-confirm", true, `data-session="${item.id}"`)}</div>`).join("")}${!sessions.others.length ? '<p class="profile-note">No other demo sessions. This is not a live list of your devices.</p>' : button("End other sessions", "revoke-all-confirm", true)}<p class="profile-note">These actions only change the prototype. Real session listing and token revocation require an authentication service. Saved demo history remains on this browser after sign-out.</p>${button("Sign out everywhere", "signout-all", true)}`;
  }
  function render({ reset = false } = {}) {
    const scroll = body.scrollTop;
    const views = { overview, details, edit: editor, notifications, membership: membershipMarkup, sessions: sessionsMarkup };
    view.innerHTML = (views[page] || (() => '<section class="profile-intro"><h2>Not found.</h2><p>Return to Profile to find your account settings.</p></section>'))();
    document.querySelector("#profile-back").setAttribute("aria-label", page === "overview" ? "Back to Home" : "Back to Profile");
    footer.innerHTML = page === "edit" ? '<button class="ds-button ds-button--solid app-button profile-action" type="submit" form="profile-edit-form">Save changes</button>' + button("Cancel", "cancel", true) : page === "notifications" ? button("Save preferences", "save-notifications") + button("Turn all off", "opt-out", true) : page === "membership" ? button("Manage in Maxio ↗", "maxio") + button("Contact support", "support", true) : page === "sessions" ? button("Sign out this session", "signout") : ["overview", "details"].includes(page) ? button("Edit profile", "edit") : button("Back to Profile", "overview");
    // Stable trigger IDs let the shared sheet restore focus after a view refresh.
    [...view.querySelectorAll("button"), ...footer.querySelectorAll("button")].forEach((control, index) => { if (!control.id) control.id = `profile-${page}-${control.dataset.profileAction || control.getAttribute("form") || index}${control.dataset.session ? `-${control.dataset.session}` : ""}`; });
    body.scrollTop = reset ? 0 : scroll;
  }
  function go(destination) { closeSheet(); navigate(destination); }
  function enter(hash) {
    active = true; page = hash === "#profile" ? "overview" : /^#profile\/[a-z-]+$/.test(hash) ? hash.split("/")[1] : "missing";
    if (page === "edit" && !detailDraft) detailDraft = { ...state.details };
    if (page === "notifications" && !notificationDraft) notificationDraft = { ...state.notifications };
    render({ reset: true });
  }
  function leave() { active = false; announcement.textContent = ""; }
  function readDraft() {
    if (page !== "edit") return;
    detailDraft = Object.fromEntries(["firstName", "lastName", "company", "timezone"].map(key => [key, document.getElementById(`profile-${key}`).value]));
  }
  function submitDetails() {
    announcement.textContent = "";
    readDraft(); const result = updateDetails(state, detailDraft);
    for (const key of ["firstName", "lastName", "company", "timezone"]) {
      const field = document.getElementById(`profile-${key}`), error = document.getElementById(`profile-${key}-error`);
      field.setAttribute("aria-invalid", String(Boolean(result.errors[key]))); error.hidden = !result.errors[key]; error.textContent = result.errors[key] || "";
    }
    if (!result.valid) { document.getElementById(`profile-${Object.keys(result.errors)[0]}`).focus(); return; }
    detailDraft = { ...state.details }; const notice = save(); onIdentityChange(); announce(`Profile updated. ${notice}`);
  }
  function applyPreferences(allOff = false) {
    if (allOff) optOut(state); else setNotifications(state, notificationDraft || state.notifications);
    notificationDraft = { ...state.notifications }; const notice = save();
    onPreferencesChange(); render();
    document.querySelector(`[data-profile-action="${allOff ? "opt-out" : "save-notifications"}"]`).focus();
    announce(`${allOff ? "All optional notifications are off." : "Notification preferences updated."} ${notice} No provider subscription was changed.`);
  }
  function external(kind) {
    const isPayment = kind === "maxio", label = isPayment ? "Maxio" : kind === "privacy" ? "Privacy Policy" : "Terms of Service";
    const target = externalDestination(profileConfig[kind]);
    openSheet(`profile-${kind}`, target ? `Open ${label}` : isPayment ? "Maxio unavailable" : label,
      target ? `<p>${isPayment ? "Payment management continues outside Master App. No payment or card details are collected here." : "This opens the published document outside Master App. Opening it does not accept any terms."}</p><div class="profile-external-host"><span>Destination</span><strong>${escape(target.host)}</strong></div><p class="profile-note">Opens a new browser tab. Return here when you're finished.</p>` : `<p>${isPayment ? "The existing Maxio payment-management URL hasn't been configured. No payment page will open and no payment can be made in Master App." : "The published document URL hasn't been supplied. This placeholder is not a legal policy or agreement."}</p><p>Contact member support if you need help.</p>`,
      target ? `<a class="ds-button ds-button--solid app-button profile-action" href="${escape(target.href)}" target="_blank" rel="noopener noreferrer">Continue to ${escape(label)} ↗</a>${button("Stay in Master App", "close", true)}` : button("Contact support", "support") + button("Back to Profile", "close", true));
  }
  function confirmSignOut(all) {
    openSheet("profile-signout", all ? "Sign out everywhere?" : "Sign out?", `<p>${all ? "End this demo session and all sample device sessions?" : "End the demo session on this browser? Other sample sessions stay active."}</p><p>Playback stops and member screens require the demo sign-in flow again. Your saved demo data remains on this browser. No real authentication tokens are revoked.</p>`, button(all ? "Sign out everywhere" : "Sign out", all ? "confirm-signout-all" : "confirm-signout") + button("Stay signed in", "close", true));
  }
  function finishSignOut(all) {
    signOutSession(sessions, all); const notice = saveSessions(); detailDraft = null; notificationDraft = null;
    onSignOut(`Signed out of the demo. ${notice} Saved demo data remains on this browser.`);
  }
  function options() {
    openSheet("profile-options", "Profile preview", '<p>Preview settings affect only this demo. They do not change a live subscription or real device session.</p>' + button("Preview membership states", "demo-membership", true) + button("Add a sample device session", "demo-session", true), button("Back to Profile", "close"));
  }
  document.addEventListener("submit", event => { if (event.target.id === "profile-edit-form" && active) { event.preventDefault(); submitDetails(); } });
  document.addEventListener("input", event => { if (active && event.target.closest("#profile-edit-form")) readDraft(); });
  document.addEventListener("change", event => {
    if (!active) return;
    if (event.target.closest("#profile-edit-form")) readDraft();
    if (event.target.id.startsWith("profile-pref-")) notificationDraft[event.target.id.replace("profile-pref-", "")] = event.target.checked;
  });
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-profile-action]"); if (!trigger || !active || trigger.disabled) return;
    const action = trigger.dataset.profileAction;
    if (["details", "edit", "notifications", "membership", "sessions"].includes(action)) go(`profile/${action}`);
    if (action === "overview") go("profile");
    if (action === "back") go(page === "overview" ? "home" : "profile");
    if (action === "cancel") { detailDraft = null; go("profile/details"); }
    if (action === "close") closeSheet();
    if (action === "options") options();
    if (action === "support") go("support");
    if (action === "plan") go("plan");
    if (["privacy", "terms", "maxio"].includes(action)) external(action);
    if (action === "save-notifications" || action === "opt-out") applyPreferences(action === "opt-out");
    if (action === "signout" || action === "signout-all") confirmSignOut(action === "signout-all");
    if (action === "confirm-signout" || action === "confirm-signout-all") finishSignOut(action === "confirm-signout-all");
    if (action === "demo-membership") openDemoMembership();
    if (action === "demo-session") { const added = addDemoSession(sessions); saveSessions(); closeSheet(); go("profile/sessions"); if (!added) announce("A sample device session already exists."); }
    if (action === "revoke-confirm" || action === "revoke-all-confirm") openSheet("profile-revoke", "End demo sessions?", '<p>This only ends the selected sample sessions. You will stay signed in on this browser. No real device is disconnected.</p>', button("End sample sessions", "revoke", false, `data-session="${action === "revoke-all-confirm" ? "all" : escape(trigger.dataset.session)}"`) + button("Keep sessions", "close", true));
    if (action === "revoke") { const done = trigger.dataset.session === "all" ? revokeOtherSessions(sessions) : revokeSession(sessions, trigger.dataset.session); const notice = saveSessions(); closeSheet(); render(); announce(done ? `Sample sessions ended. ${notice}` : "That sample session is no longer active."); }
  });
  const keepInputVisible = () => {
    const focused = document.activeElement;
    if (active && focused?.closest("#profile-edit-form") && (window.visualViewport?.scale || 1) === 1) requestAnimationFrame(() => focused.scrollIntoView({ block: "nearest" }));
  };
  window.visualViewport?.addEventListener("resize", keepInputVisible);
  window.addEventListener("resize", keepInputVisible);
  window.addEventListener("storage", event => {
    if (event.key !== SESSION_KEY) return;
    const wasSignedIn = sessions.signedIn; sessions = loadSessions();
    if (wasSignedIn && !sessions.signedIn) onSignOut("This demo session was ended in another tab. Sign in again to continue.");
    else if (active && page === "sessions") render();
  });
  return { enter, leave, refresh: () => { if (active && !["edit", "notifications"].includes(page)) render(); }, identity: () => ({ ...identity(state), company: state.details.company }), canNotify: (topic, channel) => sessions.signedIn && canNotify(state, topic, channel), isSignedIn: () => sessions.signedIn,
    signIn: () => { signInSession(sessions); saveSessions(); }, title: () => ({ overview: "Profile", details: "Member details", edit: "Edit profile", notifications: "Notification preferences", membership: "Membership", sessions: "Sessions" }[page] || "Profile"),
  };
}
