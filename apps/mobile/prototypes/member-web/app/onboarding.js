import { occupations, rangesFor, loadOnboarding, persistOnboarding, answerQuestion, routeForStep, stepForRoute, resumeRoute, questionSteps, questionProgress, answerFields, LONG_ANSWER_LIMIT } from "./onboarding-model.js";

const ambitionQuestions = Object.freeze({
  goal: {
    title: "What’s your<br />12-month goal?",
    intro: "Think 12 months ahead. What tangible result would make it a breakthrough year?",
    label: "Your 12-month goal",
    placeholder: "In 12 months, I will…",
    hint: "E.g. increase revenue by 30%, earn a promotion, or launch a new product.",
    note: "Think bigger. Make it specific.",
    pageTitle: "Your 12-month goal — Stage 2, question 1",
  },
  challenge: {
    title: "What’s in<br />your way?",
    intro: "What’s making that goal hard to reach right now? Start with your biggest challenge.",
    label: "Your biggest challenge",
    placeholder: "The biggest thing holding me back is…",
    hint: "E.g. limited time, an unclear strategy, or struggling to win new clients.",
    note: "Honest answers create a clearer path.",
    pageTitle: "Your biggest challenge — Stage 2, question 2",
  },
  skills: {
    title: "What will<br />you work on?",
    intro: "You’ve set the outcome. Now focus on the skills and habits that will help you get there.",
    label: "Skills you want to develop",
    placeholder: "I want to get better at…",
    hint: "E.g. leadership, confident communication, sales, or managing your time.",
    note: "Build the skills behind the ambition.",
    pageTitle: "Skills to develop — Stage 2, question 3",
  },
});

export function createOnboarding({ navigate, onContinue }) {
  const form = document.querySelector("#onboarding-form");
  const fields = document.querySelector("#onboarding-fields");
  const title = document.querySelector("#onboarding-title");
  const intro = document.querySelector("#onboarding-intro");
  const status = document.querySelector("#onboarding-save-status");
  const back = document.querySelector("#onboarding-back");
  const question = document.querySelector(".onboarding-question");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let entranceAnimations = [];
  let saved = loadOnboarding();
  let step = "industry";
  const drafts = Object.fromEntries(questionSteps.map(key => [key, saved.answers[answerFields[key]] || ""]));

  function finishEntrance() {
    entranceAnimations.forEach(animation => animation.cancel());
    entranceAnimations = [];
  }

  function revealQuestion() {
    finishEntrance();
    if (reducedMotion.matches || typeof question.animate !== "function") return;
    // A gentle rise with a soft start and a long settle, without scale or bounce.
    // Back and forward navigation both replay it; typing and validation do not.
    entranceAnimations = [...question.children].filter(element => !element.hidden).map((element, index) => element.animate([
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ], {
      duration: 800,
      delay: index * 60,
      easing: "cubic-bezier(0.25, 0, 0.25, 1)",
      fill: "backwards",
    }));
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) finishEntrance();
  });

  function setError(message) {
    const error = document.querySelector("#onboarding-error");
    fields.querySelectorAll("input,textarea").forEach(input => input.setAttribute("aria-invalid", String(Boolean(message))));
    if (error) { error.textContent = message; error.hidden = !message; }
  }

  // Options are static catalogue strings; every user answer is assigned using
  // .value or .textContent, including the final summary.
  function choiceMarkup(option, numeric) {
    return `<label class="onboarding-choice${numeric ? " onboarding-choice--range" : ""}">
      <input type="radio" name="${step}" value="${option.value}" required aria-describedby="onboarding-choice-hint onboarding-error" />
      <span class="onboarding-choice__copy"><span class="onboarding-choice__label${numeric ? " ds-number" : ""}">${option.label}</span>${option.description ? `<span class="onboarding-choice__description">${option.description}</span>` : ""}</span>
      <span class="onboarding-choice__mark" aria-hidden="true"></span>
    </label>`;
  }

  function renderProgress(stage, complete) {
    const progress = document.querySelector("#onboarding-progress");
    progress.dataset.stage = String(stage);
    progress.setAttribute("aria-label", complete ? "Both onboarding stages complete" : `Stage ${stage} of 2: ${stage === 1 ? "Your world" : "Your ambition"}`);
    document.querySelector("#onboarding-stage-name").textContent = stage === 1 ? "Your world" : "Your ambition";
    document.querySelector("#onboarding-stage-number").textContent = stage === 1 ? "01" : "02";
    const first = document.querySelector("#onboarding-stage-one");
    const second = document.querySelector("#onboarding-stage-two");
    first.textContent = stage === 1 ? "Stage 1: Your world, current stage" : "Stage 1: Your world, complete";
    second.textContent = complete ? "Stage 2: Your ambition, complete" : stage === 1 ? "Stage 2: Your ambition, up next" : "Stage 2: Your ambition, current stage";
    first.removeAttribute("aria-current"); second.removeAttribute("aria-current");
    if (!complete) (stage === 1 ? first : second).setAttribute("aria-current", "step");
  }

  function render() {
    status.textContent = "";
    const employee = saved.answers.occupation === "employee";
    const isIndustry = step === "industry";
    const complete = step === "complete";
    const ambition = Object.hasOwn(ambitionQuestions, step);
    const { stage, number, total } = questionProgress(step);
    document.querySelector(".onboarding-question").classList.toggle("onboarding-question--choice", !isIndustry);
    document.querySelector(".onboarding-question").classList.toggle("onboarding-question--ambition", ambition);
    document.querySelector("#onboarding-question-label").hidden = complete;
    document.querySelector("#onboarding-question-number").textContent = String(number).padStart(2, "0");
    document.querySelector("#onboarding-question-total").textContent = String(total).padStart(2, "0");
    document.querySelector("#onboarding-continue-label").textContent = complete ? "Explore my membership" : step === "skills" ? "Finish onboarding" : "Continue";
    document.querySelector(".onboarding-personal-note").textContent = ambition ? ambitionQuestions[step].note : complete ? "Your next chapter starts with you." : "An experience shaped around you.";
    const previous = questionSteps[Math.max(0, questionSteps.indexOf(step) - 1)];
    back.setAttribute("aria-label", isIndustry ? "Back to invitation" : complete ? "Back to skills" : step === "goal" ? "Back to stage 1, question 4" : `Back to question ${questionProgress(previous).number}`);
    renderProgress(stage, complete);

    if (complete) {
      title.innerHTML = "Your next<br />chapter.";
      intro.textContent = "Your goals are saved. Here’s the direction you’ve set for the next 12 months.";
      fields.innerHTML = `<dl class="onboarding-summary">${["goal", "challenge", "skills"].map(key => `<div class="onboarding-summary__item">
        <dt class="ds-eyebrow"><span>${ambitionQuestions[key].label}</span><button class="text-button onboarding-edit" type="button" data-onboarding-edit="${key}" aria-label="Edit ${ambitionQuestions[key].label.toLowerCase()}">Edit</button></dt>
        <dd data-summary-answer="${key}"></dd>
      </div>`).join("")}</dl>`;
      fields.querySelectorAll("[data-summary-answer]").forEach(element => { element.textContent = saved.answers[answerFields[element.dataset.summaryAnswer]]; });
    } else if (ambition) {
      const question = ambitionQuestions[step];
      title.innerHTML = question.title;
      intro.textContent = question.intro;
      fields.innerHTML = `<div class="ds-field">
        <div class="onboarding-field__label"><label class="ds-field__label" for="onboarding-answer">${question.label}</label><span class="onboarding-required" id="onboarding-required">Required</span></div>
        <textarea class="ds-input onboarding-input onboarding-textarea" id="onboarding-answer" name="${step}" rows="4" maxlength="${LONG_ANSWER_LIMIT}" required placeholder="${question.placeholder}" aria-describedby="onboarding-required onboarding-hint onboarding-limit onboarding-error"></textarea>
        <p class="ds-field__hint" id="onboarding-hint">${question.hint}</p>
        <div class="onboarding-answer-meta"><span id="onboarding-limit">Up to ${LONG_ANSWER_LIMIT} characters.</span><span class="ds-number" id="onboarding-character-count" aria-hidden="true"></span></div>
        <p class="ds-field__error" id="onboarding-error" role="alert" hidden></p>
      </div>`;
      document.querySelector("#onboarding-answer").value = drafts[step];
      document.querySelector("#onboarding-character-count").textContent = `${drafts[step].length} / ${LONG_ANSWER_LIMIT}`;
    } else if (isIndustry || step === "role") {
      title.innerHTML = isIndustry ? "What industry<br />are you in?" : "What’s your<br />occupation?";
      intro.textContent = isIndustry ? "Big ambition starts in your world. Tell us where you’re making your mark." : "Tell us the role you play in your industry. Every ambition has a starting point.";
      const id = isIndustry ? "onboarding-industry" : "onboarding-role";
      fields.innerHTML = `<div class="ds-field">
        <div class="onboarding-field__label"><label class="ds-field__label" for="${id}">${isIndustry ? "Your current industry" : "Your role or job title"}</label><span class="onboarding-required" id="onboarding-required">Required</span></div>
        <input class="ds-input onboarding-input" id="${id}" name="${step}" type="text" autocomplete="${isIndustry ? "off" : "organization-title"}" enterkeyhint="go" maxlength="120" required placeholder="${isIndustry ? "Type your industry" : "Type your role"}" aria-describedby="onboarding-required onboarding-hint onboarding-error" />
        <p class="ds-field__hint" id="onboarding-hint">${isIndustry ? "E.g. technology, construction, health &amp; wellness." : "E.g. marketing manager, architect, or founder."}</p>
        <p class="ds-field__error" id="onboarding-error" role="alert" hidden></p>
      </div>`;
      document.getElementById(id).value = drafts[step];
    } else {
      const occupation = step === "occupation";
      title.innerHTML = occupation ? "How do<br />you work?" : employee ? "Your annual<br />salary?" : "Your salary<br />or revenue?";
      intro.textContent = occupation ? "Choose the option that best describes how you work today." : employee ? "Your starting point helps us understand the next level you’re working towards." : "Choose your annual salary or business revenue range.";
      const label = occupation ? "Your work type" : employee ? "Annual salary" : "Annual salary / revenue";
      const options = occupation ? occupations : rangesFor(saved.answers.occupation).map(value => ({ value, label: value }));
      fields.innerHTML = `<fieldset class="onboarding-choices" aria-describedby="onboarding-choice-hint onboarding-error">
        <legend class="ds-field__label">${label} <span class="onboarding-required">(required)</span></legend>
        <p class="ds-field__hint" id="onboarding-choice-hint">Choose one option.</p>
        <div class="onboarding-choices__list">${options.map(option => choiceMarkup(option, !occupation)).join("")}</div>
        <p class="ds-field__error" id="onboarding-error" role="alert" hidden></p>
      </fieldset>`;
      fields.querySelectorAll('input[type="radio"]').forEach(input => { input.checked = input.value === drafts[step]; });
    }
    revealQuestion();
  }

  // Never leave an actively focused control faded or moving, even on fast Tab.
  form.addEventListener("focusin", event => {
    if (event.target.matches("input,textarea,button,a")) finishEntrance();
  });
  back.addEventListener("click", () => navigate(step === "industry" ? "invite" : routeForStep(step === "complete" ? "skills" : questionSteps[questionSteps.indexOf(step) - 1])));
  fields.addEventListener("click", event => {
    const edit = event.target.closest("[data-onboarding-edit]");
    if (edit) navigate(routeForStep(edit.dataset.onboardingEdit));
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (step === "complete") { onContinue(); return; }
    const textInput = fields.querySelector('textarea,input[type="text"]');
    const value = textInput ? textInput.value : fields.querySelector("input:checked")?.value;
    const result = answerQuestion(saved, step, value);
    setError(result.error);
    if (result.error) {
      status.textContent = "";
      const first = fields.querySelector("input,textarea");
      first.focus();
      (first.closest("label") || first).scrollIntoView({ block: "center", behavior: "instant" });
      return;
    }
    if (!persistOnboarding(result.state)) {
      status.textContent = "Your answer couldn’t be saved on this browser. It’s still here. Please try again.";
      return;
    }
    saved = result.state;
    drafts[step] = saved.answers[answerFields[step]];
    if (step === "occupation") drafts.income = saved.answers.incomeRange || "";
    const next = questionSteps[questionSteps.indexOf(step) + 1] || "complete";
    navigate(routeForStep(next));
  });
  fields.addEventListener("input", event => {
    if (!event.target.matches("input,textarea")) return;
    drafts[step] = event.target.value;
    const counter = document.querySelector("#onboarding-character-count");
    if (counter) counter.textContent = `${event.target.value.length} / ${LONG_ANSWER_LIMIT}`;
    status.textContent = "";
    setError("");
  });
  fields.addEventListener("focusin", event => {
    // Native textarea focus can reveal only the caret when text is enlarged.
    // Keep the whole writing area inside the visible scrolling region.
    if (event.target.matches("textarea")) event.target.scrollIntoView({ block: "center", behavior: "instant" });
  });

  return {
    resumeRoute: () => resumeRoute(saved),
    title: () => step === "complete" ? "Your 12-month direction — Onboarding complete" : Object.hasOwn(ambitionQuestions, step) ? ambitionQuestions[step].pageTitle : step === "industry" ? "Your industry — Question 1" : step === "role" ? "Your occupation — Question 2" : step === "occupation" ? "Your work type — Question 3" : saved.answers.occupation === "employee" ? "Your annual salary — Question 4" : "Your salary or revenue — Question 4",
    enter(hash) {
      const previousStage = questionProgress(step).stage;
      step = stepForRoute(hash, saved);
      const canonical = `#${routeForStep(step)}`;
      if (window.location.hash !== canonical) history.replaceState(null, "", canonical);
      render();
      document.querySelector("#onboarding-announcement").textContent = step === "complete" ? "Both stages complete. Your goals are saved." : previousStage === 1 && questionProgress(step).stage === 2 ? "Stage 1 complete. Stage 2 of 2: Your ambition." : "";
    },
  };
}
