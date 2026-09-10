import { createHome } from "./home.js";
import { createLibrary } from "./library.js";
import { createPlayer } from "./player.js";
import { createCoach } from "./coach.js";
import { createSupport } from "./support.js";
import { createProfileScreen } from "./profile.js";
import { requiresSession, safeReturnRoute, loadReturnRoute, saveReturnRoute } from "./profile-model.js";
import { renderMemberNavigation } from "./member-nav.js";
import { createEvents } from "./events.js";
import { createOnboarding } from "./onboarding.js";

document.querySelectorAll("[data-member-nav]").forEach(nav => {
  nav.innerHTML = renderMemberNavigation(nav.dataset.memberNav);
});

const screens = [...document.querySelectorAll("[data-screen]")];
const form = document.querySelector("#signin-form");
const emailInput = document.querySelector("#email");
const emailError = document.querySelector("#email-error");
const sentEmail = document.querySelector("#sent-email");
const toast = document.querySelector("#toast");

const routes = new Set(["invite", "signin", "sent", "onboarding", "plan", "adjust-goal", "home", "library", "player", "coach", "support", "profile", "events"]);
const goalForm = document.querySelector("#goal-form");
const goalName = document.querySelector("#goal-name");
const goalSuccess = document.querySelector("#goal-success");
const goalTimeframe = document.querySelector("#goal-timeframe");
const confirmGoal = document.querySelector("#confirm-goal");
const planFeedback = document.querySelector("#plan-feedback");
const appShell = document.querySelector(".app-shell");

// Sample consultation data. State is kept in memory for this prototype only.
const consultationGoal = Object.freeze({
  name: "Grow with focus",
  success: "Define three growth priorities and turn them into a weekly action plan.",
  weeks: "12",
});
let goal = { ...consultationGoal };
let goalConfirmed = false;
let planNotice = "";
let returnFocusId;
let toastTimer;
let library;
let coach;
let support;
let profile;
let events;
let pendingDestination = loadReturnRoute();
const onboarding = createOnboarding({ navigate, onContinue: () => {
  navigate("home");
  document.querySelector("#home-announcement").textContent = "Onboarding complete. Your goals are saved.";
} });
const home = createHome({
  getGoal: () => goal,
  getIdentity: () => profile?.identity(),
  openPlan: () => navigate("plan"),
  openHome: () => navigate("home"),
  openLibrary: () => navigate("library"),
  openEvents: () => navigate("events"),
  getEventCard: () => events?.homeCard() || "",
  getEventProgress: () => events?.summaryHtml() || "",
  openPlayer: id => navigate(`player/${id}`),
  openCoachScreen: () => navigate("coach"),
  openProfileScreen: page => navigate(page ? `profile/${page}` : "profile"),
  openSupportScreen: ({ consultant = false } = {}) => consultant ? support.start({ consultant: true }) : navigate("support"),
  onMemberChange: () => { library?.refresh(); player?.refresh(); coach?.refresh(); support?.refresh(); profile?.refresh(); events?.refresh(); },
});
library = createLibrary({ getMember: home.getMember, openLesson: home.openLesson, openSheet: home.openSheet, closeSheet: home.close, getRelatedEvents: ids => events?.relatedHtml(ids) || "" });
const player = createPlayer({ getMember: home.getMember, recordPosition: home.recordPosition, markComplete: home.markComplete,
  saveProgress: home.saveProgress, openLesson: home.openLesson, openLibrary: () => navigate("library"), openSheet: home.openSheet });
support = createSupport({ getMember: home.getMember, navigate, openSheet: home.openSheet, closeSheet: home.close, canNotify: () => profile?.canNotify("support", "push") === true });
coach = createCoach({ getMember: home.getMember, getGoal: () => goal, openSheet: home.openSheet, closeSheet: home.close, openLesson: home.openLesson, openLibrary: () => navigate("library"), onHandoff: support.acceptHandoff });
profile = createProfileScreen({ getMember: home.getMember, getGoal: () => goal, navigate, openSheet: home.openSheet, closeSheet: home.close, openDemoMembership: home.openDemoMembership,
  onIdentityChange: () => home.render(),
  onPreferencesChange: () => { if (!profile.canNotify("support", "push")) document.querySelector("#support-notification").hidden = true; },
  onSignOut: message => {
    player.leave(); coach.endSession(); support.endSession(); events?.leave(); home.close();
    pendingDestination = "home";
    saveReturnRoute(pendingDestination);
    history.replaceState(null, "", "#signin"); showScreen("signin");
    showToast(message);
  },
});

events = createEvents({ getMember: home.getMember, getGoal: () => goal,
  getIdentity: () => profile.identity(), navigate, openSheet: home.openSheet, closeSheet: home.close,
  openLesson: home.openLesson, openProgress: home.openProgress,
  onChange: () => { home.render(); library.refresh(); if (!document.querySelector('[data-screen="plan"]').hidden) renderPlan(); },
});

function routeFromHash() {
  const route = window.location.hash.slice(1).split("/")[0];
  return routes.has(route) ? route : "invite";
}

function showScreen(name, { moveFocus = true } = {}) {
  if (requiresSession(name) && !profile.isSignedIn()) {
    pendingDestination = safeReturnRoute(window.location.hash);
    saveReturnRoute(pendingDestination);
    history.replaceState(null, "", "#signin"); name = "signin";
  }
  player.leave();
  coach.leave();
  support.leave();
  profile.leave();
  events.leave(name);
  home.close();
  const memberScreen = ["home", "library", "player", "coach", "support", "profile", "events"].includes(name);
  appShell.classList.toggle("app-shell--home", memberScreen);
  appShell.classList.toggle("app-shell--onboarding", name === "onboarding");
  document.querySelector(".app-header").hidden = memberScreen || name === "onboarding";
  if (name === "onboarding") onboarding.enter(window.location.hash);
  if (name === "home") home.render();
  if (name === "plan") renderPlan();
  if (name === "adjust-goal") {
    goalName.value = goal.name;
    goalSuccess.value = goal.success;
    goalTimeframe.value = goal.weeks;
    [goalName, goalSuccess].forEach((input) => setGoalError(input, ""));
  }
  screens.forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
  if (name === "library") library.enter();
  else library.leave();
  if (name === "player") player.enter(window.location.hash.slice(1).split("/")[1] || "");
  if (name === "coach") coach.enter();
  if (name === "support") support.enter(window.location.hash);
  if (name === "profile") profile.enter(window.location.hash);
  if (name === "events") events.enter(window.location.hash);
  document.querySelector("#signin-description").textContent = profile.isSignedIn() ? "Enter your invitation email." : "Sign in again to continue with the sample member. No live authentication is connected.";
  document.querySelector("#demo-signin-complete").textContent = pendingDestination ? "Continue demo session" : onboarding.resumeRoute() === "onboarding/complete" ? "Review my direction" : onboarding.resumeRoute() === "onboarding" ? "Begin my experience" : "Continue my experience";

  document.title = `${name === "events" ? document.querySelector("#events-title").textContent : name === "profile" ? profile.title() : name === "support" ? support.title() : name === "player" ? document.querySelector("#player-title").textContent : screenTitle(name)} - Master App`;
  document.querySelector(`[data-screen="${name}"] .screen__body`).scrollTop = 0;
  syncViewport();
  window.scrollTo(0, 0);

  if (moveFocus) {
    const heading = document.querySelector(`[data-screen="${name}"] h1`);
    const focusTarget = returnFocusId ? document.getElementById(returnFocusId) : heading;
    returnFocusId = undefined;
    requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
  }
}

function screenTitle(name) {
  return {
    invite: "Invitation",
    signin: "Sign in",
    sent: "Check your email",
    onboarding: onboarding.title(),
    plan: "Your personalized plan",
    "adjust-goal": "Adjust your goal",
    home: "Today",
    library: "Library",
    events: "Events",
    player: "Content player",
    coach: "AaronAI coach",
    support: "Support",
    profile: "Profile",
  }[name];
}

function navigate(name) {
  if (!routes.has(name.split("/")[0])) return;

  if (window.location.hash === `#${name}`) {
    showScreen(routeFromHash());
    return;
  }

  window.location.hash = name;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toast.textContent = "";
  }, 4200);
}

function validateEmail() {
  const value = emailInput.value.trim();
  const isValid = value.length > 0 && emailInput.validity.valid;

  emailInput.setAttribute("aria-invalid", String(!isValid));
  emailError.hidden = isValid;
  emailError.textContent = isValid
    ? ""
    : value.length === 0
      ? "Enter the email address from your invitation."
      : "Enter a complete email address, such as name@example.com.";

  return isValid;
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-go]");
  if (trigger?.hasAttribute("data-cancel-goal")) returnFocusId = "adjust-goal";
  if (trigger) navigate(trigger.dataset.go);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateEmail()) {
    emailInput.focus();
    return;
  }

  sentEmail.textContent = emailInput.value.trim();
  navigate("sent");
});

document.querySelector("#demo-signin-complete").addEventListener("click", () => {
  profile.signIn();
  const destination = pendingDestination ? safeReturnRoute(pendingDestination) : onboarding.resumeRoute();
  pendingDestination = null;
  saveReturnRoute(null);
  navigate(destination);
});

emailInput.addEventListener("input", () => {
  if (emailInput.getAttribute("aria-invalid") === "true") validateEmail();
});

function goalWasAdjusted() {
  return Object.keys(consultationGoal).some((key) => goal[key] !== consultationGoal[key]);
}

function renderPlan() {
  document.querySelector("#plan-events").innerHTML = events?.summaryHtml() || "";
  const adjusted = goalWasAdjusted();
  document.querySelector("#goal-summary").textContent = goal.name;
  document.querySelector("#goal-outcome").textContent = goal.success;
  document.querySelector("#goal-weeks").textContent = goal.weeks;
  document.querySelector("#goal-source").textContent = adjusted ? "Adjusted by you" : "From your consultation";
  document.querySelector("#plan-intro").textContent = adjusted
    ? "Your goal, refined from your consultation."
    : "Built around the goal you set with your consultant.";
  document.querySelector("#plan-status").textContent = goalConfirmed ? "Confirmed" : "Ready to review";
  document.querySelector('[data-screen="plan"]').classList.toggle("is-confirmed", goalConfirmed);
  confirmGoal.hidden = goalConfirmed;
  document.querySelector("#plan-home").hidden = !goalConfirmed;
  planFeedback.textContent = goalConfirmed ? "Goal confirmed. You're ready to begin." : planNotice;
}

function setGoalError(input, message) {
  const error = document.getElementById(`${input.id}-error`);
  input.setAttribute("aria-invalid", String(Boolean(message)));
  error.textContent = message;
  error.hidden = !message;
}

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = [
    [goalName, "Enter the goal you want to work toward."],
    [goalSuccess, "Describe what achieving your goal will look like."],
  ];
  let firstInvalid;
  fields.forEach(([input, message]) => {
    const valid = input.value.trim().length > 0 && input.validity.valid;
    setGoalError(input, valid ? "" : message);
    if (!valid && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.closest(".ds-field").scrollIntoView({ block: "center" });
    return;
  }
  const nextGoal = { name: goalName.value.trim(), success: goalSuccess.value.trim(), weeks: goalTimeframe.value };
  const changed = Object.keys(nextGoal).some((key) => nextGoal[key] !== goal[key]);
  if (changed) {
    goal = nextGoal;
    goalConfirmed = false;
    planNotice = "Goal updated. Review and confirm when you're ready.";
  }
  navigate("plan");
});

[goalName, goalSuccess].forEach((input) => {
  input.addEventListener("input", () => {
    if (input.value.trim() && input.validity.valid) setGoalError(input, "");
  });
});

confirmGoal.addEventListener("click", () => {
  goalConfirmed = true;
  planNotice = "";
  navigate("home");
});

document.querySelector(".ds-skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  const content = document.querySelector('[data-screen]:not([hidden]) .screen__body');
  content.setAttribute("tabindex", "0");
  content.focus();
});

function syncViewport() {
  const viewport = window.visualViewport;
  // Keyboard resizing follows the visible viewport; pinch zoom stays browser-controlled.
  const height = viewport && viewport.scale === 1 ? viewport.height : window.innerHeight;
  appShell.style.setProperty("--app-height", `${height}px`);
  const activeActions = document.querySelector('[data-screen]:not([hidden]) .screen__actions');
  if (!activeActions) return;
  const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const headerHeight = document.querySelector(".app-header").getBoundingClientRect().height;
  const topInset = parseFloat(getComputedStyle(appShell).paddingTop);
  // Extremely short/zoomed views use document scrolling so the action band can't consume the page.
  const notificationHeight = document.querySelector("#support-notification").getBoundingClientRect().height;
  const largestChoice = appShell.classList.contains("app-shell--onboarding")
    ? Math.max(0, ...[...document.querySelectorAll(".onboarding-choice,.onboarding-textarea")].map(choice => choice.offsetHeight))
    : 0;
  // Enlarged radio cards must fit fully while focused, including their outline.
  const minimumBodyHeight = Math.max(rootSize * 7, largestChoice + rootSize * 2);
  appShell.classList.toggle("app-shell--flow", height - headerHeight - topInset - notificationHeight - activeActions.offsetHeight < minimumBodyHeight);
}

const layoutObserver = new ResizeObserver(syncViewport);
layoutObserver.observe(document.querySelector(".app-header"));
layoutObserver.observe(document.querySelector("#support-notification"));
layoutObserver.observe(document.querySelector("#onboarding-fields"));
document.querySelectorAll(".screen__actions").forEach((actions) => layoutObserver.observe(actions));
window.addEventListener("resize", syncViewport);
window.visualViewport?.addEventListener("resize", syncViewport);

window.addEventListener("hashchange", () => showScreen(routeFromHash()));

if (!window.location.hash) {
  history.replaceState(null, "", "#invite");
}

showScreen(routeFromHash(), { moveFocus: false });
