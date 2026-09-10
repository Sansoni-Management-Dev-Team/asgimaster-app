export const ONBOARDING_KEY = "master-app.onboarding.v1";
export const occupations = Object.freeze([
  { value: "employee", label: "Employee", description: "I work for an organisation." },
  { value: "business-owner", label: "Business owner", description: "I run my own business." },
]);
export const incomeRanges = Object.freeze({
  employee: Object.freeze(["100-200k", "200-300k", "300k+"]),
  "business-owner": Object.freeze(["0-100k", "100-500k", "500k-1m", "1m+"]),
});
export const rangesFor = occupation => Object.hasOwn(incomeRanges, occupation) ? incomeRanges[occupation] : [];
export const createOnboardingState = () => ({ version: 1, answers: {} });
export const LONG_ANSWER_LIMIT = 1000;
export const questionStages = Object.freeze([Object.freeze(["industry", "role", "occupation", "income"]), Object.freeze(["goal", "challenge", "skills"])]);
export const questionSteps = Object.freeze(questionStages.flat());
export const answerFields = Object.freeze({ industry: "industry", role: "role", occupation: "occupation", income: "incomeRange", goal: "goal12Months", challenge: "challenge", skills: "skills" });
export function questionProgress(step) {
  const stage = step === "complete" || questionStages[1].includes(step) ? 2 : 1;
  return { stage, number: questionStages[stage - 1].indexOf(step) + 1, total: questionStages[stage - 1].length };
}
const validOccupation = value => occupations.some(option => option.value === value);
const validText = (value, limit) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= limit;
const validIndustry = value => validText(value, 120);

export function hasAnswer(state, step) {
  const answers = state.answers;
  if (step === "industry") return validIndustry(answers.industry);
  if (step === "role") return validText(answers.role, 120);
  if (step === "occupation") return validOccupation(answers.occupation);
  if (step === "income") return rangesFor(answers.occupation).includes(answers.incomeRange);
  return ["goal", "challenge", "skills"].includes(step) && validText(answers[answerFields[step]], LONG_ANSWER_LIMIT);
}
export const onboardingComplete = state => questionSteps.every(step => hasAnswer(state, step));

export function answerQuestion(state, step, value) {
  const answers = { ...state.answers };
  let error = "";
  if (step === "industry") {
    if (typeof value !== "string" || !value.trim()) error = "Enter your current industry to continue.";
    else if (value.trim().length > 120) error = "Keep your industry to 120 characters or fewer.";
    else answers.industry = value.trim();
  } else if (!validIndustry(answers.industry)) {
    error = "Answer the industry question first.";
  } else if (step === "role") {
    if (typeof value !== "string" || !value.trim()) error = "Enter your role or job title to continue.";
    else if (value.trim().length > 120) error = "Keep your role to 120 characters or fewer.";
    else answers.role = value.trim();
  } else if (!validText(answers.role, 120)) {
    error = "Enter your role or job title first.";
  } else if (step === "occupation") {
    if (!validOccupation(value)) error = "Choose Employee or Business owner to continue.";
    else {
      if (answers.occupation !== value) delete answers.incomeRange;
      answers.occupation = value;
    }
  } else if (step === "income") {
    if (!validOccupation(answers.occupation)) error = "Choose Employee or Business owner first.";
    else if (!rangesFor(answers.occupation).includes(value)) error = "Choose one range to continue.";
    else answers.incomeRange = value;
  } else if (["goal", "challenge", "skills"].includes(step)) {
    const position = questionSteps.indexOf(step);
    if (!questionSteps.slice(0, position).every(previous => hasAnswer(state, previous))) error = "Answer the previous questions first.";
    else if (typeof value !== "string" || !value.trim()) error = { goal: "Describe your goal for the next 12 months to continue.", challenge: "Tell us what’s standing in your way to continue.", skills: "Tell us which skills you want to develop to finish." }[step];
    else if (value.trim().length > LONG_ANSWER_LIMIT) error = `Keep your answer to ${LONG_ANSWER_LIMIT} characters or fewer.`;
    else answers[answerFields[step]] = value.trim();
  } else error = "Choose an available question.";
  return { state: error ? state : { version: 1, answers }, error };
}

export const routeForStep = step => step === "industry" ? "onboarding" : `onboarding/${step}`;
export function stepForRoute(hash, state) {
  const requested = String(hash || "").replace(/^#/, "").split("/")[1];
  const position = requested === "complete" ? questionSteps.length : questionSteps.indexOf(requested);
  if (position < 0) return "industry";
  const missing = questionSteps.slice(0, position).find(step => !hasAnswer(state, step));
  return missing || requested;
}
export function resumeRoute(state) {
  const missing = questionSteps.find(step => !hasAnswer(state, step));
  return routeForStep(missing || "complete");
}

function storage() { try { return globalThis.localStorage; } catch { return null; } }
export function loadOnboarding(target = storage()) {
  let state = createOnboardingState();
  try {
    const raw = JSON.parse(target?.getItem(ONBOARDING_KEY) || "null");
    if (raw?.version !== 1 || !raw.answers) return state;
    // Preserve legacy work-type/income answers while collecting the new role.
    // Navigation, not restoration, enforces the expanded question sequence.
    if (validIndustry(raw.answers.industry)) {
      state.answers.industry = raw.answers.industry.trim();
      if (validText(raw.answers.role, 120)) state.answers.role = raw.answers.role.trim();
      if (validOccupation(raw.answers.occupation)) {
        state.answers.occupation = raw.answers.occupation;
        if (rangesFor(raw.answers.occupation).includes(raw.answers.incomeRange)) state.answers.incomeRange = raw.answers.incomeRange;
      }
    }
    // Goals remain editable if revisiting occupation invalidates the income
    // range. Route guards still require every earlier answer before advancing.
    for (const field of ["goal12Months", "challenge", "skills"]) {
      if (validText(raw.answers[field], LONG_ANSWER_LIMIT)) state.answers[field] = raw.answers[field].trim();
    }
  } catch { /* A malformed or inaccessible store starts a usable fresh flow. */ }
  return state;
}
export function persistOnboarding(state, target = storage()) {
  try { if (!target) return false; target.setItem(ONBOARDING_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
