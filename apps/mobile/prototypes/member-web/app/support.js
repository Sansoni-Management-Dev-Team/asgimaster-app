import { membershipFor } from "./home-model.js";
import { topics, statusLabels, loadSupport, saveSupport, findConversation, listConversations, unreadCount, parseSupportRoute, supportLink, startConversation, sendMessage, agentReply, markRead, resolveConversation, reopenConversation, MESSAGE_LIMIT } from "./support-model.js";

const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (name = "chat") => `<svg class="support-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${{ chat: '<path d="M21 11a9 9 0 0 1-9 9H4l1-4A9 9 0 1 1 21 11Z"/><path d="M8 9h8M8 13h5"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', check: '<path d="m5 12 4 4L19 6"/>', bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/>', back: '<path d="m14 5-7 7 7 7"/>' }[name]}</svg>`;
const button = (label, action, secondary = false, extra = "") => `<button type="button" class="support-action ${secondary ? "text-button" : "ds-button ds-button--solid app-button"}" data-support-action="${action}" ${extra}>${escape(label)}</button>`;
const date = value => new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
const time = value => new Date(value).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

export function createSupport({ getMember, navigate, openSheet, closeSheet, canNotify = () => true }) {
  const state = loadSupport();
  const body = document.querySelector("#support-body"), view = document.querySelector("#support-view");
  const form = document.querySelector("#support-compose"), input = document.querySelector("#support-reply");
  const composerError = document.querySelector("#support-reply-error"), footer = document.querySelector("#support-primary-actions");
  const status = document.querySelector("#support-announcement"), notification = document.querySelector("#support-notification");
  const dialog = document.querySelector("#home-dialog"), drafts = new Map();
  let route = { view: "current" }, active = false, storageAvailable = true, failNext = false, entryNotice = "", newDraft = { topic: "general", text: "", context: "" };
  const current = () => route.view === "conversation" ? findConversation(state, route.id) : null;
  const permissions = () => ({ consultant: Boolean(membershipFor(getMember()).coach) });
  const retention = () => storageAvailable ? "Saved on this browser." : "Kept for this visit only; browser storage is unavailable.";
  const announce = text => { (dialog.open ? document.querySelector("#sheet-announcement") : status).textContent = text; };

  function updateBadge() {
    const count = unreadCount(state);
    document.querySelectorAll('[data-member-nav] [data-home-action="support"]').forEach(nav => {
      nav.querySelector(".support-nav-count")?.remove();
      if (count) {
        const badge = document.createElement("span"); badge.className = "support-nav-count"; badge.setAttribute("aria-hidden", "true"); badge.textContent = count;
        nav.append(badge); nav.setAttribute("aria-label", `Support, ${count} unread conversation${count === 1 ? "" : "s"}`);
      } else nav.removeAttribute("aria-label");
    });
  }
  function persist() {
    storageAvailable = saveSupport(state);
    document.querySelector("#support-storage").textContent = storageAvailable ? "Demo only. Saved on this browser, not sent to a person." : "Storage unavailable. This demo lasts for this visit only; nothing is sent.";
    updateBadge();
  }
  function setError(text, isNew = false) {
    const field = isNew ? document.querySelector("#support-new-message") : input;
    const error = isNew ? document.querySelector("#support-new-error") : composerError;
    error.hidden = !text; error.textContent = text; field.setAttribute("aria-invalid", String(Boolean(text)));
    if (text) field.focus();
  }
  function sizeInput() {
    input.style.height = "auto";
    if (!form.hidden) input.style.height = `${Math.min(input.scrollHeight, parseFloat(getComputedStyle(input).fontSize) * 6)}px`;
  }
  function row(item) {
    const last = item.messages.at(-1);
    return `<a class="support-thread ds-card" href="${supportLink(item.id)}"><span class="support-thread-top"><span class="support-state support-state--${item.status}">${item.status === "resolved" ? "✓ " : ""}${statusLabels[item.status]}</span>${item.unread ? '<span class="support-unread">Unread</span>' : ""}</span><strong>${escape(topics[item.topic])}</strong><span class="support-preview">${last.role === "agent" ? "Alex · Demo agent: " : last.role === "user" ? "You: " : ""}${escape(last.text.slice(0, 96))}${last.text.length > 96 ? "…" : ""}</span><span class="support-thread-bottom"><span>${date(item.updatedAt)} · ${item.messages.length} message${item.messages.length === 1 ? "" : "s"}</span>${icon("arrow")}</span></a>`;
  }
  function inbox() {
    const history = route.view === "history", rows = listConversations(state, history);
    const open = listConversations(state).length;
    const intro = state.conversations.length ? '<section class="support-inbox-summary"><p class="ds-eyebrow">Member care</p><h2>Your inbox</h2><p>Pick up a conversation or revisit a resolved request.</p></section>' : '<section class="support-intro"><div class="support-emblem" aria-hidden="true">' + icon() + '</div><p class="ds-eyebrow">Member care</p><h2>Here for<br>you.</h2><p>App, access or your next step.<br>Keep the conversation with your team in one place.</p></section>';
    return `${intro}<div class="support-switch" role="group" aria-label="Support conversations"><button type="button" data-support-action="current" aria-pressed="${!history}">Current <span class="ds-number">${open}</span></button><button type="button" data-support-action="history" aria-pressed="${history}">History <span class="ds-number">${listConversations(state, true).length}</span></button></div><div class="support-list" aria-label="${history ? "Conversation history" : "Current conversations"}">${rows.length ? rows.map(row).join("") : `<div class="support-empty"><h3>${history ? "No past requests" : "All clear"}</h3><p>${history ? "Resolved conversations will stay here. You can reopen one if you need more help." : "You have no open conversations. Start one whenever you need a hand."}</p></div>`}</div><p class="support-disclaimer">This is a human-support preview, separate from AaronAI. Agent replies are simulated; no real team is connected.</p>`;
  }
  function newConversation() {
    if (newDraft.topic === "consultant" && !permissions().consultant) newDraft.topic = "general";
    return `<section class="support-new-intro"><p class="ds-eyebrow">Let's work it out</p><h2>Let's<br>talk.</h2><p>A little context helps your team pick up where you are.</p></section><form id="support-new-form" class="support-new-form" novalidate><div class="ds-field"><label class="ds-field__label" for="support-new-topic">Topic</label><select class="ds-input" id="support-new-topic">${Object.entries(topics).filter(([key]) => key !== "consultant" || permissions().consultant).map(([key, label]) => `<option value="${key}" ${newDraft.topic === key ? "selected" : ""}>${escape(label)}</option>`).join("")}</select></div><div class="ds-field"><label class="ds-field__label" for="support-new-message">Your message (required)</label><textarea class="ds-input" id="support-new-message" rows="5" maxlength="${MESSAGE_LIMIT}" required placeholder="Tell us what's happening…" aria-describedby="support-new-error support-privacy">${escape(newDraft.text)}</textarea><p class="ds-field__error" id="support-new-error" role="alert" hidden></p></div><p id="support-privacy" class="support-disclaimer">Don't include passwords, card details or sensitive information. This demo saves messages locally and doesn't send them to an agent.</p>${newDraft.context ? `<details class="support-context"><summary>Shared AaronAI conversation</summary><div>${escape(newDraft.context)}</div></details>` : ""}</form>`;
  }
  function messageMarkup(message) {
    if (message.role === "system") return `<p class="support-system" id="support-msg-${message.id}">${icon("check")} ${escape(message.text)}</p>`;
    return `<article class="support-message support-message--${message.role}" id="support-msg-${message.id}" tabindex="-1" aria-label="${message.role === "user" ? "Your message" : "Alex, demo support agent"}"><div class="support-message-meta"><strong>${message.role === "user" ? "You" : 'Alex <span>Demo agent</span>'}</strong><time datetime="${escape(message.createdAt)}" title="${escape(date(message.createdAt))}">${escape(time(message.createdAt))}</time></div><div class="support-message-text">${escape(message.text)}</div>${message.role === "user" ? '<span class="support-receipt">Saved locally · Not sent</span>' : ""}</article>`;
  }
  function conversationMarkup(item) {
    const hasAgent = item.messages.some(message => message.role === "agent");
    return `<div class="support-case-heading"><p class="ds-eyebrow">Request ${escape(item.id.slice(-6).toUpperCase())}</p><h2>${escape(topics[item.topic])}</h2><span class="support-state support-state--${item.status}">${item.status === "resolved" ? "✓ " : ""}${statusLabels[item.status]}</span></div><div class="support-agent"><span class="support-agent-avatar" aria-hidden="true">${hasAgent ? "A" : icon()}</span><div><strong>${hasAgent ? "Alex · Demo agent" : item.topic === "consultant" ? "Consultant team" : "Member Care"}</strong><p>${item.status === "resolved" ? "Closed for now. Reopen if you need us." : hasAgent ? "Human-support preview · Not AaronAI" : "Waiting for a person · Demo only"}</p></div></div><p class="support-date">Started ${date(item.createdAt)}</p>${item.context ? `<details class="support-context"><summary>Shared AaronAI conversation</summary><div>${escape(item.context)}</div></details>` : ""}<div role="log" aria-label="Support conversation" aria-live="off">${item.messages.map(messageMarkup).join("")}</div>${item.status === "waiting" ? '<aside class="support-waiting"><strong>Your conversation is open.</strong><p>In the live app, a person will reply here. This preview has no live agent or promised response time.</p></aside>' : ""}${item.status === "resolved" ? '<aside class="support-resolved"><strong>✓ Conversation resolved</strong><p>Your messages stay in History. Reopen this conversation if the same issue needs another look.</p></aside>' : ""}`;
  }
  function render({ reset = false } = {}) {
    const scroll = body.scrollTop;
    const item = current();
    document.querySelector("#support-back").hidden = ["current", "history"].includes(route.view);
    document.querySelector("#support-title").textContent = route.view === "new" ? "New request" : "Support";
    form.hidden = !item || item.status === "resolved";
    if (route.view === "new") view.innerHTML = newConversation();
    else if (["current", "history"].includes(route.view)) view.innerHTML = inbox();
    else if (item) view.innerHTML = conversationMarkup(item);
    else view.innerHTML = `<section class="support-intro"><div class="support-emblem" aria-hidden="true">${icon()}</div><h2>Not found.</h2><p>This link doesn't match a conversation saved on this browser. Nothing has been opened.</p><p>Return to Support to find your requests or start a new one.</p></section>`;
    footer.innerHTML = route.view === "new" ? '<button type="submit" form="support-new-form" class="ds-button ds-button--solid app-button support-action">Start conversation</button>' : item ? (item.status === "resolved" ? button("Reopen conversation", "reopen") + button("New conversation", "new", true) : button("Mark as resolved", "resolve-confirm", true)) : button(["current", "history"].includes(route.view) ? "Start a conversation" : "Back to Support", ["current", "history"].includes(route.view) ? "new" : "current");
    document.querySelector("#support-latest").hidden = !item?.unread;
    document.querySelector("#support-reply-label").textContent = "Reply to your team (required)";
    sizeInput();
    body.scrollTop = reset ? 0 : scroll;
  }
  function latest() {
    const item = current(); if (!item) return;
    markRead(state, item.id); persist(); document.querySelector("#support-latest").hidden = true;
    const message = document.getElementById(`support-msg-${item.messages.at(-1).id}`);
    message?.scrollIntoView({ block: "start", behavior: "auto" });
    message?.focus({ preventScroll: true });
  }
  function enter(hash) {
    active = true; route = parseSupportRoute(hash); input.value = drafts.get(route.id) || ""; setError("");
    const item = current();
    if (item) { markRead(state, item.id); persist(); }
    render({ reset: true });
    if (item) requestAnimationFrame(() => { if (active && current()?.id === item.id) document.getElementById(`support-msg-${item.messages.at(-1).id}`)?.scrollIntoView({ block: "start" }); });
    updateBadge();
    if (entryNotice) { announce(entryNotice); entryNotice = ""; }
  }
  function leave() {
    if (active && route.id) drafts.set(route.id, input.value);
    captureNewDraft(); active = false; status.textContent = "";
  }
  function captureNewDraft() {
    if (active && route.view === "new" && document.querySelector("#support-new-message")) {
      newDraft.text = document.querySelector("#support-new-message").value;
      newDraft.topic = document.querySelector("#support-new-topic").value;
    }
  }
  function go(destination) { closeSheet(); navigate(destination); }
  function start({ consultant = false } = {}) { newDraft = { topic: consultant && permissions().consultant ? "consultant" : "general", text: "", context: "" }; go("support/new"); }
  function simulateFailure(isNew) {
    if (!failNext) return false;
    failNext = false; setError("The demo send failed. Your draft is still here. Try sending again.", isNew); return true;
  }
  function submitNew() {
    captureNewDraft();
    if (!newDraft.text.trim()) { setError("Tell us what you need help with.", true); return; }
    if (simulateFailure(true)) return;
    const result = startConversation(state, newDraft, permissions());
    if (result.error) { setError(result.error, true); return; }
    // Clear the submitted form before navigation can capture it as an unsent draft.
    document.querySelector("#support-new-message").value = "";
    newDraft = { topic: "general", text: "", context: "" }; persist();
    entryNotice = `Demo conversation started. ${retention()} No person was contacted.`;
    go(`support/${result.conversation.id}`);
  }
  function submitReply() {
    if (!input.value.trim()) { setError("Write a reply before sending."); return; }
    if (simulateFailure(false)) return;
    const result = sendMessage(state, route.id, input.value);
    if (result.error) { setError(result.error); return; }
    input.value = ""; drafts.delete(route.id); setError(""); persist(); render(); latest(); input.focus();
    announce(`Reply added to this demo conversation. ${retention()} No message was sent to an agent.`);
  }
  function openOptions() {
    const item = current();
    openSheet("support-options", "Support options", `<p>This is a preview of real-person support, separate from AaronAI. Messages stay on this browser and aren't sent. Don't include sensitive information.</p><p>History isn't synchronized across devices. Live push permissions, delivery and agent availability aren't connected.</p>${item ? `<p class="ds-eyebrow">Conversation link</p><a class="support-deep-link" href="${supportLink(item.id)}" data-support-action="deep-link">Open this conversation ${icon("arrow")}</a><p class="support-disclaimer">The URL identifies this conversation; it contains no message text. It works after a reload on this browser.</p>` : ""}<details class="demo-controls"><summary>Demo settings</summary><p>These buttons simulate agent events. They don't contact a person or send a real push notification.</p>${item && item.status !== "resolved" ? button("Add agent reply", "demo-reply") + button("Agent resolves request", "demo-resolve", true) + button("Preview reply notification", "demo-push", true) : '<p>Open a current conversation to preview agent replies and a notification.</p>'}<label class="support-check"><input id="support-fail-next" type="checkbox" ${failNext ? "checked" : ""}/><span>Fail the next demo send once</span></label></details>`, button("Back to Support", "close"));
  }
  function demoAgent({ resolve = false, push = false } = {}) {
    const item = current(); if (!item) return;
    const result = agentReply(state, item.id, { resolve });
    if (result.error) { announce(result.error); return; }
    persist(); closeSheet();
    if (push) {
      // Same destination a future authenticated push adapter should open. No Notification API is used.
      navigate("home");
      if (!canNotify()) {
        notification.hidden = true;
        document.querySelector("#support-push-announcement").textContent = "Demo reply saved. Push preview is off in your notification preferences. Read your reply in Support.";
        return;
      }
      notification.innerHTML = `<div><p>Master App · Demo notification</p><strong>A support reply is ready.</strong><a class="support-notification-link" href="${supportLink(item.id)}" data-support-action="notification-open">Open conversation ${icon("arrow")}</a></div><button class="ds-icon-button" type="button" data-support-action="dismiss-notification" aria-label="Dismiss support notification">×</button>`;
      notification.hidden = false;
      document.querySelector("#support-push-announcement").textContent = "Demo notification: a support reply is ready. Use Open conversation to read it.";
    } else {
      render(); announce(resolve ? "Demo agent marked the request resolved. A new reply is available." : "A demo agent reply is available. Use View new reply to read it.");
    }
  }
  function acceptHandoff(summary) {
    const result = startConversation(state, { topic: summary.team === "Your consultant" ? "consultant" : "general", text: summary.note, context: summary.transcript || "" }, permissions());
    if (result.error) { announce(result.error); return false; }
    persist(); entryNotice = `Your reviewed handoff is in this demo conversation. ${retention()} No person was contacted.`; go(`support/${result.conversation.id}`); return true;
  }
  function refresh() {
    if (!active) return;
    // Preserve typed form content when an unrelated modal closes or access changes.
    if (route.view === "new") {
      captureNewDraft();
      if (newDraft.topic === "consultant" && !permissions().consultant) { newDraft.topic = "general"; render(); }
    }
    updateBadge();
  }
  form.addEventListener("submit", event => { event.preventDefault(); submitReply(); });
  input.addEventListener("input", () => { setError(""); drafts.set(route.id, input.value); sizeInput(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); submitReply(); } });
  document.addEventListener("submit", event => { if (event.target.id === "support-new-form") { event.preventDefault(); submitNew(); } });
  document.addEventListener("input", event => { if (event.target.id === "support-new-message") { captureNewDraft(); setError("", true); } });
  document.addEventListener("change", event => {
    if (event.target.id === "support-fail-next") failNext = event.target.checked;
    if (event.target.id === "support-new-topic") captureNewDraft();
  });
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-support-action]"); if (!trigger || trigger.disabled) return;
    const action = trigger.dataset.supportAction;
    if (action === "notification-open") { notification.hidden = true; return; }
    if (action === "dismiss-notification") { notification.hidden = true; document.querySelector('[data-screen]:not([hidden]) h1')?.focus(); return; }
    if (!active) return;
    if (action === "current") go("support");
    if (action === "history") go("support/history");
    if (action === "new") start();
    if (action === "close") closeSheet();
    if (action === "options") openOptions();
    if (action === "deep-link") { event.preventDefault(); go(`support/${route.id}`); }
    if (action === "latest") latest();
    if (action === "demo-reply") demoAgent();
    if (action === "demo-resolve") demoAgent({ resolve: true });
    if (action === "demo-push") demoAgent({ push: true });
    if (action === "resolve-confirm") openSheet("support-resolve", "All sorted?", '<p>Mark this conversation resolved? It will move to History. You can reopen it if you still need help.</p>', button("Yes, resolve", "resolve") + button("Keep it open", "close", true));
    if (action === "resolve") { if (resolveConversation(state, route.id)) { persist(); closeSheet(); render(); announce("Conversation resolved and saved in History."); } else announce("This conversation couldn't be resolved. Return to Support and try again."); }
    if (action === "reopen") { if (reopenConversation(state, route.id)) { persist(); render(); input.focus(); announce("Conversation reopened. Add a message about what you still need."); } else announce("This demo conversation is full. Start a new conversation for further help."); }
  });
  const keepInputVisible = () => {
    const focused = document.activeElement;
    if (active && [input, document.querySelector("#support-new-message")].includes(focused) && (window.visualViewport?.scale || 1) === 1) requestAnimationFrame(() => focused.scrollIntoView({ block: "nearest" }));
  };
  window.visualViewport?.addEventListener("resize", keepInputVisible);
  window.addEventListener("resize", keepInputVisible);
  updateBadge();
  return { enter, leave, refresh, start, acceptHandoff, endSession: () => { active = false; drafts.clear(); newDraft = { topic: "general", text: "", context: "" }; input.value = ""; notification.hidden = true; document.querySelector("#support-push-announcement").textContent = ""; }, title: () => current() ? `${topics[current().topic]} · ${current().id.slice(-6)} · Support` : route.view === "new" ? "New support request" : route.view === "history" ? "Support history" : "Support" };
}
