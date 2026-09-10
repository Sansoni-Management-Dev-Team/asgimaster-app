import { membershipFor, canWatch, lessons } from "./home-model.js";
import { coachConfig } from "./coach-config.js";
import { loadCoach, saveCoach, coachAccess, currentConversation, beginMessage, resolveMessage, failMessage, retryMessage, demoReply, deleteConversation, buildHandoff, MESSAGE_LIMIT } from "./coach-model.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const icon = name => `<svg class="coach-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${{
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  history: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2"/>',
  send: '<path d="m5 12 7-7 7 7M12 5v15"/>',
  person: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
}[name] || '<path d="M5 12h14m-6-6 6 6-6 6"/>'}</svg>`;
const actionButton = (label, action, secondary = false, extra = "") => `<button type="button" class="coach-action ${secondary ? "text-button" : "ds-button ds-button--solid app-button"}" data-coach-action="${action}" ${extra}>${escape(label)}</button>`;
const dateLabel = value => new Date(value).toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });

export function createCoach({ getMember, getGoal, openSheet, closeSheet, openLesson, openLibrary, onHandoff }) {
  const state = loadCoach();
  const screen = document.querySelector('[data-screen="coach"]');
  const body = document.querySelector("#coach-body");
  const view = document.querySelector("#coach-view");
  const input = document.querySelector("#coach-message");
  const form = document.querySelector("#coach-form");
  const fieldError = document.querySelector("#coach-message-error");
  const status = document.querySelector("#coach-status");
  const dialog = document.querySelector("#home-dialog");
  const drafts = new Map();
  let mode = coachConfig.mode, active = false, pending = null, responseTimer;
  let failNext = false, storageAvailable = true, newReplyId = null, handoffDraft = null, reviewedHandoff = null, lastAccess;
  const access = () => coachAccess(getMember(), mode);
  const chat = () => currentConversation(state);
  const draftKey = () => state.activeId || "new";
  const announce = message => {
    if (!active) return;
    if (dialog.open) document.querySelector("#sheet-announcement").textContent = message;
    else status.textContent = message;
  };

  function persist() {
    const success = saveCoach(state);
    if (!success && storageAvailable) announce("Browser storage is unavailable. Your conversation will last for this visit only.");
    storageAvailable = success;
    document.querySelector("#coach-storage-note").textContent = success ? "Saved on this browser. Avoid sensitive information." : "Not saved to this browser. History lasts for this visit only.";
  }

  function error(message) {
    fieldError.textContent = message; fieldError.hidden = !message;
    input.setAttribute("aria-invalid", String(Boolean(message)));
    if (message && form.hidden) announce(message);
  }

  function updateChrome() {
    const currentAccess = access();
    document.querySelector("#coach-availability").textContent = currentAccess === "demo" ? "Demo coach · No API connected" : currentAccess === "waitlist" ? "Launch preview · Not live" : currentAccess === "locked" ? "Not included in your access" : "Unavailable · Demo preview";
    form.hidden = currentAccess !== "demo";
    input.disabled = currentAccess !== "demo";
    document.querySelector("#coach-send").disabled = currentAccess !== "demo" || Boolean(pending);
    document.querySelector("#coach-send").setAttribute("aria-label", pending ? "Wait for reply" : "Send message");
    const blockedActions = document.querySelector("#coach-blocked-actions");
    blockedActions.hidden = currentAccess === "demo";
    blockedActions.innerHTML = currentAccess === "waitlist" ? actionButton(state.waitlisted ? "You're on the demo list" : "Join waitlist", "waitlist", false, state.waitlisted ? "disabled" : "") + (state.waitlisted ? actionButton("Leave demo waitlist", "leave-waitlist", true) : "") : currentAccess === "unavailable" ? actionButton("Check availability", "check-availability") : '<button class="ds-button ds-button--solid app-button" type="button" data-home-action="membership">View membership</button>';
    document.querySelector("#coach-new-reply").hidden = !newReplyId;
    document.querySelector("#coach-draft-count").textContent = input.value.length > 1800 ? `${input.value.length} / ${MESSAGE_LIMIT} characters` : "";
  }

  function messageMarkup(message) {
    const assistant = message.role === "assistant";
    const lesson = message.lessonId && lessons.find(item => item.id === message.lessonId);
    const failed = message.status === "failed";
    return `<article class="coach-message ${assistant ? "coach-message--assistant" : "coach-message--user"}" id="coach-msg-${escape(message.id)}" tabindex="-1" aria-label="${assistant ? "AaronAI demo reply" : "Your message"}"><p class="coach-speaker">${assistant ? `${icon("spark")} AaronAI <span>Demo</span>` : "You"}</p><div class="coach-message-text">${escape(message.text)}</div>
      ${lesson ? `<button class="coach-lesson-link" type="button" data-coach-action="lesson" data-lesson="${escape(lesson.id)}" ${canWatch(getMember(), lesson) ? "" : "disabled"}>${icon("arrow")}<span>${canWatch(getMember(), lesson) ? `Open lesson: ${escape(lesson.title)}` : "Lesson not included in your current access"}</span></button>` : ""}
      ${message.handoff ? actionButton("Review a handoff", "handoff", true) : ""}
      ${failed ? `<div class="coach-send-failure"><strong>No reply yet</strong><p>${escape(message.failure)}</p><div>${actionButton("Retry message", "retry", true, `data-message="${escape(message.id)}" ${access() !== "demo" || pending ? "disabled" : ""}`)}${actionButton("Remove message", "remove-message", true, `data-message="${escape(message.id)}"`)}</div></div>` : ""}</article>`;
  }

  function unavailableMarkup() {
    const currentAccess = access();
    const title = currentAccess === "waitlist" ? "Coming soon" : currentAccess === "locked" ? "Human help.\nStill here." : "Taking a pause";
    const detail = currentAccess === "waitlist" ? `AaronAI isn't ready to launch. You can join the demo waitlist. For now, ${membershipFor(getMember()).coach ? "your consultant and member support" : "member support"} can help you keep moving.` : currentAccess === "locked" ? "AaronAI isn't included in your current access. You can still read your saved conversations and contact member support." : "AaronAI can't reply right now. Your saved history is still available. A person can help in the meantime.";
    const waitlistNote = state.waitlisted ? `Your interest is saved ${storageAvailable ? "on this browser" : "for this visit only"}. No signup or notification has been sent.` : "Demo only. Joining saves your interest on this browser; no signup is sent.";
    return `<section class="coach-empty coach-empty--unavailable"><div class="coach-emblem" aria-hidden="true">${icon(currentAccess === "locked" ? "lock" : "spark")}</div><p class="ds-eyebrow">${currentAccess === "waitlist" ? "A new way to move forward" : "You're not on your own"}</p><h2>${escape(title)}</h2><p>${detail}</p>${currentAccess === "waitlist" ? `<p class="coach-local-note">${waitlistNote}</p>` : ""}</section>`;
  }

  function render({ resetScroll = false } = {}) {
    const focusedId = view.contains(document.activeElement) ? document.activeElement.id : null;
    const currentAccess = access();
    lastAccess = currentAccess;
    const conversation = chat();
    const scroll = body.scrollTop;
    if (conversation) {
      view.innerHTML = `${currentAccess !== "demo" ? `<aside class="coach-readonly-note"><strong>${currentAccess === "waitlist" ? "Not launched yet" : currentAccess === "locked" ? "Read-only access" : "Coach unavailable"}</strong><p>Your history is available, but new replies aren't. ${currentAccess === "waitlist" ? "You can join the demo waitlist below." : "Talk to a person for your next step."}</p></aside>` : ""}<div class="coach-thread-heading"><span>Conversation · ${escape(dateLabel(conversation.createdAt))}</span><button type="button" data-coach-action="new">New chat <span aria-hidden="true">+</span></button></div><div id="coach-log" role="log" aria-label="Conversation with AaronAI" aria-live="off">${conversation.messages.map(messageMarkup).join("")}${pending?.chatId === conversation.id ? `<div class="coach-thinking"><span aria-hidden="true">···</span><span>Preparing a demo reply</span><button type="button" data-coach-action="stop">Stop reply</button></div>` : ""}</div>`;
    } else if (currentAccess !== "demo") view.innerHTML = unavailableMarkup();
    else view.innerHTML = `<section class="coach-empty"><div class="coach-emblem" aria-hidden="true">${icon("spark")}</div><p class="ds-eyebrow">A little clarity, ${escape(getMember().firstName)}</p><h2>Think it<br>through.</h2><p>Turn your learning into a next step that feels manageable.</p><div class="coach-goal"><span>Your current goal</span><strong>${escape(getGoal().name)}</strong></div></section><div class="coach-prompts" aria-label="Conversation starters"><button type="button" data-coach-action="prompt" data-prompt="What should I do next?">Find my next step ${icon("arrow")}</button><button type="button" data-coach-action="prompt" data-prompt="Help me plan my week">Make a plan for this week ${icon("arrow")}</button><button type="button" data-coach-action="prompt" data-prompt="Help me apply a lesson">Put a lesson into practice ${icon("arrow")}</button></div>`;
    updateChrome();
    if (resetScroll) body.scrollTop = 0;
    else body.scrollTop = scroll;
    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
  }

  function showLatest({ focus = false } = {}) {
    const message = newReplyId ? document.getElementById(`coach-msg-${newReplyId}`) : [...view.querySelectorAll(".coach-message")].at(-1);
    newReplyId = null; document.querySelector("#coach-new-reply").hidden = true;
    message?.scrollIntoView({ block: "start", behavior: "auto" });
    if (focus) message?.focus({ preventScroll: true });
  }

  function finish(request) {
    if (pending !== request) return;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 100;
    const conversation = state.conversations.find(item => item.id === request.chatId);
    const question = conversation?.messages.find(item => item.id === request.messageId)?.text;
    pending = null;
    let reply;
    if (failNext) { failNext = false; failMessage(state, request, "The demo connection was interrupted. Try again; retrying won't duplicate your message."); }
    else if (question) {
      reply = demoReply(question, getMember(), getGoal());
      if (!resolveMessage(state, request, reply, getMember(), mode)) reply = null;
    }
    persist();
    if (!active) return;
    if (reply && state.activeId === request.chatId) newReplyId = chat().messages.at(-1).id;
    render();
    if (reply) {
      if (atBottom && !dialog.open) showLatest();
      announce(dialog.open ? "Your AaronAI demo reply is ready. Return to the conversation to read it." : `AaronAI demo: ${reply.text}`);
    } else announce("No reply arrived. You can retry your message.");
  }

  function start(request) {
    pending = request; newReplyId = null;
    persist(); render(); showLatest();
    announce("Preparing a demo reply.");
    responseTimer = setTimeout(() => finish(request), coachConfig.responseDelayMs);
  }

  function send(text = input.value, { fromPrompt = false } = {}) {
    const request = beginMessage(state, text, getMember(), mode);
    if (request.error) { error(request.error); if (!input.disabled && !form.hidden) input.focus(); return; }
    drafts.delete("new"); drafts.delete(draftKey()); input.value = ""; resizeInput(); error("");
    start(request);
    (fromPrompt ? document.getElementById(`coach-msg-${request.messageId}`) : input)?.focus({ preventScroll: true });
  }

  function stop(detail = "You stopped this reply. Retry whenever you're ready.") {
    if (!pending) return;
    const focusMessage = document.activeElement?.dataset.coachAction === "stop" ? pending.messageId : null;
    clearTimeout(responseTimer); failMessage(state, pending, detail); pending = null;
    persist(); if (active) render();
    if (focusMessage) document.getElementById(`coach-msg-${focusMessage}`)?.focus({ preventScroll: true });
  }

  function chooseConversation(chatId) {
    drafts.set(draftKey(), input.value);
    if (pending) stop("The reply was interrupted when you changed conversations. You can retry when you're ready.");
    state.activeId = state.conversations.some(item => item.id === chatId) ? chatId : null;
    input.value = drafts.get(draftKey()) || ""; resizeInput(); error(""); newReplyId = null;
    persist(); closeSheet(); render({ resetScroll: true });
    requestAnimationFrame(() => document.querySelector("#coach-title").focus({ preventScroll: true }));
  }

  function openHistory() {
    const rows = [...state.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    openSheet("coach-history", "History", `<p>${storageAvailable ? "Saved on this browser, not across devices. You can delete a conversation from its options." : "Browser storage is unavailable. This history lasts for this visit only."}</p>${rows.length ? `<div class="coach-history-list">${rows.map(item => `<button type="button" class="coach-history-item" data-coach-action="history-item" data-chat="${escape(item.id)}" ${item.id === state.activeId ? 'aria-current="true"' : ""}><strong>${escape(item.title)}</strong><span>${escape(dateLabel(item.updatedAt))} · ${item.messages.filter(message => message.role === "user").length} messages${item.messages.some(message => message.status === "failed") ? " · Needs retry" : ""}${item.id === state.activeId ? " · Current" : ""}</span></button>`).join("")}</div>` : '<div class="coach-history-empty"><h3>A fresh start</h3><p>Your conversations will appear here after your first message.</p></div>'}`, actionButton("New conversation", "new") + actionButton("Back to coach", "close", true));
  }

  function openAbout() {
    openSheet("coach-about", "About AaronAI", `<p class="sheet-eyebrow">A thinking partner, not your consultant</p><div class="coach-about-section"><h3>What it can help with</h3><p>Reflect on your learning, break down a goal and explore a manageable next step.</p></div><div class="coach-about-section"><h3>What it can't do</h3><p>Change your agreed plan, make payments, update membership or act on your behalf. It doesn't replace your consultant or qualified medical, legal or financial advice. It isn't an emergency service.</p></div><div class="coach-about-section"><h3>Check important decisions</h3><p>AI can be wrong. Confirm important guidance with a person who understands your situation.</p></div><div class="coach-about-section"><h3>What this demo knows</h3><p>Only the sample goal, lesson descriptions and learning progress shown in Master App. Replies are scripted, not generated by an AaronAI API. It can't read private consultation notes or actual course recordings.</p></div><p>Messages are saved on this browser, not sent to an AI provider. Avoid sensitive information, especially on a shared device. Handoffs and waitlist entries are also demos.</p>`, actionButton("Talk to a person", "handoff") + actionButton("Back to coach", "close", true));
  }

  function openOptions() {
    openSheet("coach-options", "Coach options", `${actionButton("New conversation", "new")}${actionButton("About AaronAI", "about", true)}${chat() ? actionButton("Delete this conversation", "delete-confirm", true) : ""}<details class="demo-controls"><summary>Demo settings</summary><p>Preview launch readiness and reply errors. Prompts are unlimited; no real service is affected.</p><label class="ds-field__label" for="coach-demo-mode">Coach availability</label><select class="ds-input" id="coach-demo-mode"><option value="demo">Demo conversation</option><option value="waitlist">Launch waitlist</option><option value="unavailable">Temporarily unavailable</option></select><label class="coach-check"><input id="coach-demo-error" type="checkbox" ${failNext ? "checked" : ""}/><span>Make the next reply fail once</span></label></details>`, actionButton("Apply demo settings", "apply-demo") + actionButton("Back to coach", "close", true));
    document.querySelector("#coach-demo-mode").value = mode;
  }

  function openHandoff({ edit = false } = {}) {
    if (!edit || !handoffDraft) handoffDraft = { team: "support", note: "I'd like help choosing my next step.", includeConversation: false };
    const personal = membershipFor(getMember()).coach;
    if (!personal) handoffDraft.team = "support";
    openSheet("coach-handoff", "Talk to a person", `<p>Choose who can help. You'll review the request before finishing this demo. Nothing is sent.</p><form id="coach-handoff-form" novalidate><div class="ds-field"><label class="ds-field__label" for="coach-handoff-team">Who can help?</label><select class="ds-input" id="coach-handoff-team"><option value="support">Member support · app and access</option>${personal ? '<option value="consultant">Your consultant · plan and learning</option>' : ""}</select></div><div class="ds-field"><label class="ds-field__label" for="coach-handoff-note">What do you need? (required)</label><textarea class="ds-input" id="coach-handoff-note" maxlength="2000" rows="3" required aria-describedby="coach-handoff-error">${escape(handoffDraft.note)}</textarea><p class="ds-field__error" id="coach-handoff-error" role="alert" hidden></p></div>${chat() ? `<label class="coach-check"><input type="checkbox" id="coach-include-chat" ${handoffDraft.includeConversation ? "checked" : ""}/><span>Include this conversation<span class="coach-check-hint">Off by default. Only share what you're comfortable including.</span></span></label>` : ""}</form>`, '<button class="ds-button ds-button--solid app-button" type="submit" form="coach-handoff-form">Review request</button>' + actionButton("Back to coach", "close", true));
    document.querySelector("#coach-handoff-team").value = handoffDraft.team;
  }

  function reviewHandoff() {
    const note = document.querySelector("#coach-handoff-note");
    const errorNode = document.querySelector("#coach-handoff-error");
    const valid = note.value.trim().length > 0 && note.value.length <= MESSAGE_LIMIT;
    note.setAttribute("aria-invalid", String(!valid)); errorNode.hidden = valid;
    if (!valid) { errorNode.textContent = "Add a short message about the help you need."; note.focus(); return; }
    handoffDraft = { team: document.querySelector("#coach-handoff-team").value, note: note.value.trim(), includeConversation: Boolean(document.querySelector("#coach-include-chat")?.checked) };
    const summary = buildHandoff(chat(), handoffDraft, getMember());
    reviewedHandoff = summary; // Preserve the exact consented transcript even if a reply arrives after review.
    openSheet("coach-handoff-review", "Review request", `<p class="sheet-eyebrow">${escape(summary.team)}</p><div class="membership-notice"><strong>Your message</strong><p>${escape(summary.note)}</p></div><h3 class="sheet-section-title">Conversation sharing</h3><p>${summary.transcript ? "Included below. Check it before continuing." : "Not included. Only your request message would be shared."}</p>${summary.transcript ? `<div class="coach-handoff-transcript" role="region" aria-label="Conversation included in this request" tabindex="0">${escape(summary.transcript)}</div>` : ""}<p class="demo-caption">Prototype only. No request will be sent to a person.</p>`, actionButton("Confirm demo handoff", "confirm-handoff") + actionButton("Edit request", "edit-handoff", true));
  }

  function resizeInput() {
    input.style.height = "auto";
    if (!form.hidden) input.style.height = `${Math.min(input.scrollHeight, parseFloat(getComputedStyle(input).fontSize) * 6)}px`;
  }

  function enter() {
    active = true;
    input.value = drafts.get(draftKey()) || ""; render({ resetScroll: true }); resizeInput();
  }
  function leave() { drafts.set(draftKey(), input.value); active = false; status.textContent = ""; }
  function refresh() {
    if (!active) return;
    if (pending && access() !== "demo") stop("Coach access changed before the reply arrived. You can retry when you're ready.");
    if (lastAccess !== access()) render(); else updateChrome();
  }

  form.addEventListener("submit", event => { event.preventDefault(); send(); });
  input.addEventListener("input", () => { drafts.set(draftKey(), input.value); error(""); resizeInput(); updateChrome(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); send(); } });
  document.addEventListener("submit", event => { if (event.target.id === "coach-handoff-form") { event.preventDefault(); reviewHandoff(); } });
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-coach-action]");
    if (!button || !active || button.disabled) return;
    const action = button.dataset.coachAction;
    if (action === "history") openHistory();
    if (action === "history-item") chooseConversation(button.dataset.chat);
    if (action === "new") chooseConversation(null);
    if (action === "options") openOptions();
    if (action === "about") openAbout();
    if (action === "close") closeSheet();
    if (action === "prompt") send(button.dataset.prompt, { fromPrompt: true });
    if (action === "latest") showLatest({ focus: true });
    if (action === "stop") { stop(); announce("Reply stopped. You can retry when you're ready."); }
    if (action === "retry") { const request = retryMessage(state, button.dataset.message, getMember(), mode); if (request.error) announce(request.error); else { error(""); start(request); document.getElementById(`coach-msg-${request.messageId}`)?.focus({ preventScroll: true }); } }
    if (action === "remove-message") {
      const conversation = chat(), message = conversation?.messages.find(item => item.id === button.dataset.message);
      if (message?.status !== "failed") return;
      // Explicit removal of only the failed local message, never the rest of the conversation.
      conversation.messages = conversation.messages.filter(item => item !== message);
      if (!conversation.messages.length) deleteConversation(state, conversation.id);
      persist(); render(); input.focus(); announce("Unanswered message removed.");
    }
    if (action === "lesson") { const lesson = lessons.find(item => item.id === button.dataset.lesson); if (canWatch(getMember(), lesson)) openLesson(lesson.id); else openLibrary(); }
    if (action === "waitlist" || action === "leave-waitlist") { state.waitlisted = action === "waitlist"; persist(); render(); document.querySelector(`[data-coach-action="${state.waitlisted ? "leave-waitlist" : "waitlist"}"]`)?.focus(); announce(state.waitlisted ? `Demo interest saved${storageAvailable ? " on this browser" : " for this visit"}. No signup was sent and no notification will be sent.` : "Removed from the demo waitlist. Nothing was sent."); }
    if (action === "check-availability") announce("AaronAI is still unavailable in this demo. Your history and human support are available.");
    if (action === "handoff") openHandoff();
    if (action === "edit-handoff") openHandoff({ edit: true });
    if (action === "confirm-handoff" && reviewedHandoff) { if (onHandoff(reviewedHandoff)) reviewedHandoff = null; }
    if (action === "delete-confirm") openSheet("coach-delete", "Delete conversation?", '<p>This removes this conversation from this browser. It cannot be undone.</p>', actionButton("Delete conversation", "delete") + actionButton("Keep conversation", "close", true));
    if (action === "delete") { if (pending) stop(); const deletedId = state.activeId; deleteConversation(state, deletedId); drafts.delete(deletedId); persist(); chooseConversation(null); announce("Conversation deleted from this browser. It cannot be recovered."); }
    if (action === "apply-demo") {
      const chosen = document.querySelector("#coach-demo-mode").value;
      if (!["demo", "waitlist", "unavailable"].includes(chosen)) return;
      if (pending) stop("Preview settings changed before the reply arrived. You can retry when you're ready.");
      drafts.set(draftKey(), input.value); mode = chosen;
      error("");
      failNext = document.querySelector("#coach-demo-error").checked;
      persist(); closeSheet(); render({ resetScroll: true });
      requestAnimationFrame(() => document.querySelector("#coach-title").focus({ preventScroll: true }));
      announce("Coach preview updated. No live service was contacted.");
    }
  });
  // Persisted pending messages are restored as retryable failures on a reload.
  window.addEventListener("pagehide", () => { if (pending) { stop("The reply was interrupted when the page closed. You can retry when you're ready."); } });
  const keepComposerVisible = () => {
    if (active && document.activeElement === input && (window.visualViewport?.scale || 1) === 1) requestAnimationFrame(() => input.scrollIntoView({ block: "nearest", behavior: "auto" }));
  };
  window.visualViewport?.addEventListener("resize", keepComposerVisible);
  window.addEventListener("resize", keepComposerVisible);
  return { enter, leave, refresh, endSession: () => { stop("You signed out before the reply arrived. You can retry when you're ready."); drafts.clear(); input.value = ""; handoffDraft = null; reviewedHandoff = null; } };
}
