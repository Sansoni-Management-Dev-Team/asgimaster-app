import { memberships, createMember, membershipFor, getDashboard, recordWatch, completeLesson } from "./home-model.js";
import { restoreProgress, persistProgress } from "./player-model.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const icon = (name, className = "") => {
  const paths = {
    arrow: '<path d="M6 18 18 6M6 6h12v12"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    chat: '<path d="M20 11a8 8 0 0 1-8 8H4l1.5-4A8 8 0 1 1 20 11Z"/><path d="M8 10h8M8 14h5"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  };
  return `<svg class="home-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.arrow}</svg>`;
};

export function createHome({ getGoal, getIdentity, openPlan, openHome, openLibrary, openEvents, getEventCard = () => "", getEventProgress = () => "", openPlayer, openCoachScreen, openProfileScreen, openSupportScreen, onMemberChange }) {
  let member = restoreProgress(createMember());
  let returnTrigger;
  let sheetKind;
  const dashboard = document.querySelector("#home-dashboard");
  const primary = document.querySelector("#home-next");
  const dialog = document.querySelector("#home-dialog");
  const sheetTitle = document.querySelector("#sheet-title");
  const body = document.querySelector("#sheet-body");
  const actions = document.querySelector("#sheet-actions");
  const announcement = document.querySelector("#home-announcement");
  const sheetAnnouncement = document.querySelector("#sheet-announcement");
  const announce = message => {
    // A modal makes the page outside it inert, including outside live regions.
    (dialog.open ? sheetAnnouncement : announcement).textContent = message;
  };
  const identify = () => { const person = getIdentity?.(); if (person) { member.firstName = person.firstName; member.initials = person.initials; } return member; };
  const data = () => getDashboard(identify(), getGoal());
  const backLabel = () => !document.querySelector('[data-screen="profile"]').hidden ? "Back to Profile" : !document.querySelector('[data-screen="support"]').hidden ? "Back to Support" : !document.querySelector('[data-screen="coach"]').hidden ? "Back to coach" : !document.querySelector('[data-screen="player"]').hidden ? "Back to lesson" : document.querySelector('[data-screen="library"]').hidden ? "Back to home" : "Back to library";
  const button = (label, action, extra = "", secondary = false) => `<button type="button" class="${secondary ? "text-button" : "ds-button ds-button--solid app-button"}" data-home-action="${action}" ${extra}>${escape(label)}</button>`;

  function ring(label, value, unit, percent, accessible, category) {
    return `<button class="home-metric home-metric--${category}" id="metric-${category}" type="button" data-home-action="progress" aria-label="${escape(label)}: ${escape(accessible)}. View progress.">
      <span class="home-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="home-ring__track" cx="50" cy="50" r="44"/><circle class="home-ring__fill" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${Math.max(0, Math.min(100, percent))} 100"/></svg><span class="home-metric__value">${escape(value)}<span class="home-metric__unit">${escape(unit)}</span></span></span>
      <span class="home-metric__label">${label}<span aria-hidden="true"> ›</span></span></button>`;
  }

  function lessonRow(lesson, reason = "Included in your membership", prefix = "lesson") {
    return `<button class="lesson-row" type="button" data-home-action="lesson" data-lesson="${lesson.id}" id="${prefix}-${lesson.id}">
      <span class="lesson-duration"><span class="ds-number">${lesson.minutes}</span><span>min</span></span>
      <span class="lesson-row__copy"><strong>${escape(lesson.title)}</strong><span>${escape(reason)}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>`;
  }

  function render() {
    const d = data();
    const goal = getGoal();
    const needsPayment = d.membership.status === "payment_due";
    const paused = d.membership.status === "paused";
    const resumed = d.resume;
    dashboard.innerHTML = `
      <header class="home-header">
        <button class="home-avatar" type="button" data-home-action="profile" id="home-profile" aria-label="${escape(member.firstName)}'s profile and settings">${escape(member.initials)}</button>
        <div class="home-date"><h1 id="home-title" tabindex="-1">Today</h1></div>
      </header>
      <section class="home-overview" aria-label="Learning progress">
        <div class="home-metrics">
          ${ring("Course", d.coursePercent, "%", d.coursePercent, `${d.complete.length} of ${d.entitled.length} included lessons complete, ${d.coursePercent} percent`, "course")}
          ${ring("Learning", d.weeklyMinutes, "m", d.weeklyMinutes / 60 * 100, `${d.weeklyMinutes} of 60 learning minutes this week`, "learning")}
          ${ring("Actions", d.actionsDone, "/3", d.actionsDone / 3 * 100, `${d.actionsDone} of 3 weekly actions complete`, "actions")}
        </div>
      </section>
      ${needsPayment || paused ? `<aside class="home-notice" aria-label="Membership notice"><span aria-hidden="true">!</span><div><strong>${paused ? "Your membership is paused" : "A payment needs attention"}</strong><p>${paused ? "Your foundation lessons are still available." : "Your learning access is still active."}</p><button type="button" data-home-action="membership">Review membership ${icon("arrow")}</button></div></aside>` : ""}
      <div class="home-status-grid">
        <button class="ds-card home-status-card" type="button" data-home-action="membership" id="home-membership"><span class="home-card-heading">Membership <span aria-hidden="true">›</span></span><span class="home-card-state">${icon(needsPayment || paused ? "lock" : "check")} ${paused ? "Limited access" : needsPayment ? "Payment due" : `${escape(d.membership.name)} active`}</span><span class="home-card-detail">${d.entitled.length} lessons included</span></button>
        <button class="ds-card home-status-card" type="button" data-home-action="support-menu" id="home-support"><span class="home-card-heading">Your support <span aria-hidden="true">›</span></span><span class="home-card-state">${icon("chat")} Here to help</span><span class="home-card-detail">${d.membership.coach ? "AaronAI + your consultant" : d.membership.ai ? "AaronAI + member support" : "Member support"}</span></button>
      </div>
      <section class="home-section" aria-labelledby="my-day-title">
        <h2 id="my-day-title">My day</h2>
        <p class="home-goal-context">Your focus: <span>${escape(goal.name)}</span></p>
        <button class="ds-card next-action-card" type="button" data-home-action="next" id="home-next-card"><span class="next-action-icon">${icon(d.next.kind === "lesson" ? "arrow" : "check")}</span><span><span class="ds-eyebrow">Your next move</span><strong>${escape(d.next.title)}</strong><span class="home-card-detail">${escape(d.next.detail)}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>
      </section>
      ${resumed ? `<section class="home-section" aria-labelledby="continue-title"><h2 class="home-section__label" id="continue-title">Continue watching</h2><button class="ds-card continue-card" type="button" data-home-action="lesson" data-lesson="${resumed.id}" id="continue-lesson"><span class="lesson-art" aria-hidden="true">${icon("play")}<span>MASTER<br>CLASS</span></span><span class="continue-copy"><span class="ds-eyebrow">${escape(resumed.course)}</span><strong>${escape(resumed.title)}</strong><span class="home-card-detail">${clock(member.positions[resumed.id])} / ${resumed.minutes}:00 <span aria-hidden="true">·</span> ${Math.max(1,Math.ceil((resumed.minutes*60-member.positions[resumed.id])/60))} min left</span><span class="lesson-track" aria-hidden="true"><span style="width:${member.positions[resumed.id]/(resumed.minutes*60)*100}%"></span></span></span></button></section>` : ""}
      ${getEventCard()}
      <section class="home-section" aria-labelledby="recommend-title">
        <div class="home-section-heading"><h2 class="home-section__label" id="recommend-title">${d.recommendations.length ? "Picked for you" : "Your learning"}</h2><button class="home-inline-link" type="button" data-home-action="library">View all <span aria-hidden="true">↗</span></button></div>
        ${d.recommendations.length ? `<div class="ds-card recommendation-card">${d.recommendations.map(lesson => lessonRow(lesson, lesson.tags.some(tag => `${goal.name} ${goal.success}`.toLowerCase().includes(tag)) ? "For your current goal" : "Included in your programme")).join("")}</div>` : `<p class="home-empty">${d.incomplete.length ? "Your next lesson is ready above." : "You've finished every lesson included in your membership. Revisit any lesson in Library."}</p>`}
      </section>
      <button class="home-week-row" type="button" data-home-action="progress" id="home-week"><span>${icon("check")} This week's actions</span><span>${d.actionsDone} of 3 <span aria-hidden="true">›</span></span></button>
      ${d.membership.ai ? `<button class="ds-card home-ai-row" type="button" data-home-action="ask" id="home-aaron"><span class="next-action-icon">${icon("spark")}</span><span><strong>A little guidance?</strong><span>Work through your next step with AaronAI.</span></span><span class="row-chevron" aria-hidden="true">›</span></button>` : ""}
    `;
    primary.textContent = d.next.label;
  }

  function openSheet(kind, title, content, footer = "") {
    if (!dialog.open) returnTrigger = document.activeElement;
    sheetKind = kind;
    sheetTitle.textContent = title;
    body.innerHTML = content;
    actions.innerHTML = footer;
    actions.hidden = !footer;
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0;
    sheetTitle.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("close", () => {
    const activeScreen = document.querySelector('[data-screen]:not([hidden])');
    if (["home", "library", "player", "coach", "support", "profile", "events"].includes(activeScreen?.dataset.screen)) {
      if (activeScreen.dataset.screen === "home") render();
      onMemberChange();
      const replacement = returnTrigger?.id ? document.getElementById(returnTrigger.id) : null;
      const connected = returnTrigger?.isConnected && !returnTrigger.closest('[hidden]');
      (connected ? returnTrigger : replacement && !replacement.closest('[hidden]') ? replacement : activeScreen.querySelector("h1"))?.focus();
    }
  });
  document.querySelector("#sheet-close").addEventListener("click", close);

  function openLesson(id) {
    close(); openPlayer(id);
  }

  function openProgress() {
    const d = data();
    openSheet("progress", "Your progress", `<p class="sheet-eyebrow">${escape(getGoal().name)} · ${escape(getGoal().weeks)} weeks</p>
      <div class="progress-summary"><strong class="ds-number">${d.coursePercent}%</strong><span>${d.complete.length} of ${d.entitled.length} included lessons complete</span><progress max="${d.entitled.length}" value="${d.complete.length}" aria-label="Included lessons completed"></progress></div>
      <p>${d.weeklyMinutes} learning minutes this week. Your weekly aim is 60 minutes.</p>${getEventProgress()}
      <h3 class="sheet-section-title">This week's actions · ${d.actionsDone}/3</h3>
      <ul class="weekly-checklist"><li><span aria-hidden="true">${member.weeklyCompleted.length ? "✓" : "○"}</span><span>Complete a lesson<strong>${member.weeklyCompleted.length ? "Done this week" : "Your next lesson is ready"}</strong></span></li><li><span aria-hidden="true">${member.focusDone ? "✓" : "○"}</span><span>Set your weekly focus<strong>${member.focusDone ? escape(member.focusNote || "Focus set") : "Choose one action toward your goal"}</strong></span></li><li><span aria-hidden="true">${member.reflectionDone ? "✓" : "○"}</span><span>Reflect on your week<strong>${member.reflectionDone ? "Reflection complete" : "Notice what moved forward"}</strong></span></li></ul>`,
      button(!member.focusDone ? "Set weekly focus" : !member.reflectionDone ? "Reflect on my week" : backLabel(), !member.focusDone ? "focus" : !member.reflectionDone ? "reflection" : "close") + button("View my plan", "plan", "", true));
  }

  function openAction(kind) {
    const focus = kind === "focus";
    openSheet(kind, focus ? "Your weekly focus" : "A moment to reflect", `<p>${focus ? `What's one action you can take toward “${escape(getGoal().name)}” this week?` : "What moved you forward this week, and what will you try next?"}</p><form id="weekly-form"><label class="ds-field__label" for="weekly-note">${focus ? "My next action" : "My reflection"} (required)</label><textarea class="ds-input" id="weekly-note" rows="4" maxlength="400" required aria-describedby="weekly-error">${escape(focus ? member.focusNote || "" : member.reflectionNote || "")}</textarea><p class="ds-field__error" id="weekly-error" role="alert" hidden></p></form>`, button("Save " + (focus ? "focus" : "reflection"), "save-weekly"));
  }

  function openDemoMembership() {
    const d = data();
    const status = d.membership.status;
    openSheet("membership", "Your membership", `<div class="membership-heading"><span class="home-avatar">${escape(member.initials)}</span><div><strong>${escape(member.firstName)}</strong><span>${escape(d.membership.name)} membership</span></div></div>
      <div class="membership-notice"><strong>${status === "active" ? "Membership active" : status === "payment_due" ? "Payment needs attention" : "Membership paused"}</strong><p>${status === "active" ? "Your included learning is ready whenever you are." : status === "payment_due" ? "Your current learning access remains active. Contact member support for help with the payment." : "Foundation lessons remain available. Growth lessons and AaronAI are currently unavailable."}</p></div>
      <h3 class="sheet-section-title">Your access</h3><ul class="access-list"><li>${d.entitled.length} included lessons</li><li>${d.membership.ai ? "AaronAI guidance included" : "AaronAI not included"}</li><li>${d.membership.coach ? "Consultant support included" : "Member support included"}</li></ul>
      <details class="demo-controls"><summary>Demo settings</summary><p>Preview how membership and learning activity change your home. Membership resets on reload. Learning activity is saved on this browser; choosing a preset replaces that saved activity.</p><label class="ds-field__label" for="demo-membership">Membership preview</label><select class="ds-input" id="demo-membership"><option value="growth" ${member.membership === "growth" ? "selected" : ""}>Growth · active</option><option value="essentials" ${member.membership === "essentials" ? "selected" : ""}>Essentials · active</option><option value="payment" ${member.membership === "payment" ? "selected" : ""}>Growth · payment due</option><option value="paused" ${member.membership === "paused" ? "selected" : ""}>Membership paused</option></select><label class="ds-field__label" for="demo-progress">Learning activity</label><select class="ds-input" id="demo-progress"><option value="current">Keep current activity</option><option value="new">New member · no activity</option><option value="returning">Returning member · some progress</option><option value="complete">All included learning completed</option></select><button type="button" class="ds-button app-button" data-home-action="apply-demo">Apply demo settings</button></details>`, button(status === "payment_due" ? "Get payment help" : "Contact support", "support") + button("View my plan", "plan", "", true));
  }

  function openSupportMenu() {
    const m = membershipFor(member);
    openSheet("support-menu", "Here for you", `<p>A little help to keep you moving.</p>${m.ai ? `<button class="support-option" type="button" data-home-action="ask">${icon("spark")}<span><strong>Ask AaronAI</strong><span>Work through your goal and next step.</span></span><span aria-hidden="true">›</span></button>` : ""}<button class="support-option" type="button" data-home-action="support">${icon("chat")}<span><strong>${m.coach ? "Your consultant & support" : "Member support"}</strong><span>${m.coach ? "Your plan, membership, or learning." : "Help with your access and learning."}</span></span><span aria-hidden="true">›</span></button>`, button("Back to today", "close"));
  }

  function openCoach() {
    close(); openCoachScreen();
  }

  function openSupport({ consultant = false } = {}) {
    close(); openSupportScreen({ consultant });
  }

  function openAsk() {
    openCoach();
  }

  function goNext() {
    const next = data().next;
    if (next.kind === "lesson") openLesson(next.lesson.id);
    else if (next.kind === "progress") openProgress();
    else openAction(next.kind);
  }

  function validateNote(id, errorId, message) {
    const input = document.getElementById(id);
    const error = document.getElementById(errorId);
    const valid = Boolean(input.value.trim());
    input.setAttribute("aria-invalid", String(!valid));
    error.hidden = valid; error.textContent = valid ? "" : message;
    if (!valid) input.focus();
    return valid ? input.value.trim() : null;
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-home-action]");
    if (!trigger) return;
    const action = trigger.dataset.homeAction;
    if (action === "today") { close(); openHome(); }
    if (action === "close") close();
    if (action === "plan") { close(); openPlan(); }
    if (action === "next") goNext();
    if (action === "lesson") openLesson(trigger.dataset.lesson);
    if (action === "library") { close(); openLibrary(); }
    if (action === "events") { close(); openEvents(); }
    if (action === "progress") openProgress();
    if (action === "membership") { close(); openProfileScreen("membership"); }
    if (action === "profile") { close(); openProfileScreen(); }
    if (action === "coach") openCoach();
    if (action === "consultant") { if (membershipFor(member).coach) openSupport({ consultant: true }); else openCoach(); }
    if (action === "support-menu") openSupportMenu();
    if (action === "support") openSupport();
    if (action === "ask") openAsk();
    if (action === "focus" || action === "reflection") openAction(action);
    if (action === "save-weekly") {
      const note = validateNote("weekly-note", "weekly-error", "Add a short note before saving.");
      if (!note) return;
      const focus = sheetKind === "focus";
      member[focus ? "focusDone" : "reflectionDone"] = true;
      member[focus ? "focusNote" : "reflectionNote"] = note;
      render(); openProgress(); announce(focus ? "Weekly focus saved." : "Weekly reflection saved.");
    }
    if (action === "apply-demo") {
      const membership = document.querySelector("#demo-membership").value;
      const snapshot = document.querySelector("#demo-progress").value;
      if (!memberships[membership]) return;
      if (snapshot === "new") member = createMember({ fresh: true, membership });
      else if (snapshot === "returning") member = createMember({ membership });
      else member.membership = membership;
      if (snapshot === "complete") {
        data().entitled.forEach(lesson => completeLesson(member, lesson.id));
        member.focusDone = true; member.reflectionDone = true;
      }
      persistProgress(member);
      close(); render(); announce("Demo membership updated. Your home now reflects this member's access and progress.");
    }
  });
  primary.addEventListener("click", goNext);
  return { render, close, openLesson, openSheet, openProgress, openDemoMembership, getMember: identify,
    recordPosition: (id, position, elapsed) => recordWatch(member, id, position, elapsed),
    markComplete: id => completeLesson(member, id),
    saveProgress: () => persistProgress(member),
  };
}
