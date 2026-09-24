import test from "node:test";
import assert from "node:assert/strict";
import { ONBOARDING_KEY, LONG_ANSWER_LIMIT, createOnboardingState, answerQuestion, rangesFor, stepForRoute, resumeRoute, loadOnboarding, persistOnboarding, onboardingComplete, questionProgress } from "./onboarding-model.js";
const storage = value => { let raw = value; return { getItem: () => raw, setItem: (_key,value) => { raw = value; } }; };
const answer = (state, step, value) => { const result = answerQuestion(state, step, value); assert.equal(result.error, ""); return result.state; };
const industryState = () => answer(createOnboardingState(), "industry", "  Technology & 健康  ");
const roleState = () => answer(industryState(), "role", "Marketing manager");

test("legacy industry-only answers resume at the free-text role without fabricated completion", () => {
  const state = loadOnboarding(storage(JSON.stringify(industryState())));
  assert.equal(state.answers.industry, "Technology & 健康");
  assert.equal(resumeRoute(state), "onboarding/role");
  assert.deepEqual(Object.keys(state), ["version", "answers"]);
});

test("each occupation accepts exactly its supplied ranges and rejects the other branch", () => {
  const options = { employee: ["100-200k", "200-300k", "300k+"], "business-owner": ["0-100k", "100-500k", "500k-1m", "1m+"] };
  for (const [occupation,ranges] of Object.entries(options)) {
    const state = answer(roleState(), "occupation", occupation);
    assert.deepEqual(rangesFor(occupation), ranges);
    for (const range of ranges) assert.equal(answer(state, "income", range).answers.incomeRange, range);
    for (const range of options[occupation === "employee" ? "business-owner" : "employee"]) assert.ok(answerQuestion(state, "income", range).error);
    assert.ok(answerQuestion(state, "income", undefined).error);
  }
});

test("changing occupation clears income, while revisiting the same occupation preserves it", () => {
  const employee = answer(answer(roleState(), "occupation", "employee"), "income", "200-300k");
  assert.equal(answer(employee, "occupation", "employee").answers.incomeRange, "200-300k");
  const owner = answer(employee, "occupation", "business-owner");
  assert.equal(owner.answers.incomeRange, undefined);
  assert.equal(resumeRoute(owner), "onboarding/income");
  const employeeAgain = answer(answer(owner, "income", "1m+"), "occupation", "employee");
  assert.equal(employeeAgain.answers.incomeRange, undefined);
  assert.equal(employee.answers.incomeRange, "200-300k");
});

test("validation never mutates saved answers or accepts invalid occupations", () => {
  const state = roleState(), before = JSON.stringify(state);
  for (const value of [undefined, "", "other", "constructor", "__proto__", {}]) {
    const result = answerQuestion(state, "occupation", value);
    assert.ok(result.error); assert.equal(result.state, state);
  }
  for (const value of [" ", "x".repeat(121), 12]) assert.ok(answerQuestion(state, "industry", value).error);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(rangesFor("constructor"), []);
});

test("direct links cannot skip prerequisite questions; Back can revisit completed answers", () => {
  const empty = createOnboardingState(), industry = roleState(), occupation = answer(industry, "occupation", "employee");
  assert.equal(stepForRoute("#onboarding/income", empty), "industry");
  assert.equal(stepForRoute("#onboarding/income", industry), "occupation");
  assert.equal(stepForRoute("#onboarding/income", occupation), "income");
  assert.equal(stepForRoute("#onboarding/occupation", occupation), "occupation");
  assert.equal(stepForRoute("#onboarding", occupation), "industry");
  assert.equal(stepForRoute("#onboarding/unknown", occupation), "industry");
  assert.ok(answerQuestion(empty, "occupation", "employee").error);
  assert.ok(answerQuestion(industry, "income", "100-200k").error);
});

test("reload retains valid answers and discards malformed or mismatched downstream data", () => {
  const local = storage(), state = answer(answer(roleState(), "occupation", "business-owner"), "income", "500k-1m");
  assert.equal(persistOnboarding(state, local), true);
  assert.deepEqual(loadOnboarding(local), state);
  assert.equal(resumeRoute(state), "onboarding/goal");
  local.setItem(ONBOARDING_KEY, JSON.stringify({ ...state, answers: { ...state.answers, incomeRange: "300k+", completed: true } }));
  assert.deepEqual(loadOnboarding(local).answers, { industry: state.answers.industry, role: "Marketing manager", occupation: "business-owner" });
  local.setItem(ONBOARDING_KEY, JSON.stringify({ version: 1, answers: { industry: " ", occupation: "employee", incomeRange: "300k+" } }));
  assert.deepEqual(loadOnboarding(local), createOnboardingState());
});

test("corrupt, denied or full storage is recoverable without a successful save claim", () => {
  const blocked = { getItem() { throw Error("denied"); }, setItem() { throw Error("full"); } };
  for (const local of [null, blocked, storage("broken"), storage('{"version":99}')]) assert.deepEqual(loadOnboarding(local), createOnboardingState());
  assert.equal(persistOnboarding(roleState(), null), false);
  assert.equal(persistOnboarding(roleState(), blocked), false);
});

const stageOneState = occupation => answer(answer(roleState(), "occupation", occupation), "income", rangesFor(occupation)[0]);
const completeState = () => answer(answer(answer(stageOneState("business-owner"), "goal", "  Increase revenue by 30%  "), "challenge", "Finding new clients"), "skills", "Leadership and communication");

test("either occupation enters stage two after income, with no premature completion", () => {
  for (const occupation of ["employee", "business-owner"]) {
    const state = stageOneState(occupation);
    assert.equal(resumeRoute(state), "onboarding/goal");
    assert.equal(onboardingComplete(state), false);
    assert.equal(stepForRoute("#onboarding/complete", state), "goal");
  }
});

test("stage two stores outcome, challenge and skills as separate free-text answers", () => {
  const goal = answer(stageOneState("employee"), "goal", "  Earn a promotion\n在十二个月内  ");
  assert.equal(goal.answers.goal12Months, "Earn a promotion\n在十二个月内");
  assert.equal(resumeRoute(goal), "onboarding/challenge");
  const challenge = answer(goal, "challenge", "Limited time");
  assert.equal(resumeRoute(challenge), "onboarding/skills");
  const final = answer(challenge, "skills", "Confident communication");
  assert.equal(final.answers.challenge, "Limited time");
  assert.equal(final.answers.skills, "Confident communication");
  assert.equal(onboardingComplete(final), true);
  assert.equal(resumeRoute(final), "onboarding/complete");
});

test("stage two rejects blanks and overlong input without changing saved answers", () => {
  const state = completeState(), snapshot = JSON.stringify(state);
  for (const step of ["goal", "challenge", "skills"]) {
    for (const value of [undefined, "\n \t", 123, "x".repeat(LONG_ANSWER_LIMIT + 1)]) {
      const result = answerQuestion(state, step, value);
      assert.ok(result.error); assert.equal(result.state, state);
    }
    assert.equal(answer(state, step, "x".repeat(LONG_ANSWER_LIMIT)).answers[step === "goal" ? "goal12Months" : step].length, LONG_ANSWER_LIMIT);
  }
  assert.equal(JSON.stringify(state), snapshot);
});

test("stage two and completion links stop at the first missing prerequisite", () => {
  assert.equal(stepForRoute("#onboarding/skills", roleState()), "occupation");
  const stageOne = stageOneState("employee");
  assert.equal(stepForRoute("#onboarding/challenge", stageOne), "goal");
  assert.ok(answerQuestion(stageOne, "skills", "Leadership").error);
  const goal = answer(stageOne, "goal", "Launch a product");
  assert.equal(stepForRoute("#onboarding/complete", goal), "challenge");
  assert.equal(stepForRoute("#onboarding/goal", completeState()), "goal");
  assert.equal(stepForRoute("#onboarding/complete", completeState()), "complete");
});

test("back-editing stage one retains goals through reload but invalidates completion until income is answered", () => {
  const original = completeState();
  const changed = answer(original, "occupation", "employee");
  const loaded = loadOnboarding(storage(JSON.stringify(changed)));
  assert.equal(loaded.answers.goal12Months, original.answers.goal12Months);
  assert.equal(loaded.answers.challenge, original.answers.challenge);
  assert.equal(loaded.answers.skills, original.answers.skills);
  assert.equal(loaded.answers.incomeRange, undefined);
  assert.equal(onboardingComplete(loaded), false);
  assert.equal(stepForRoute("#onboarding/skills", loaded), "income");
  assert.equal(onboardingComplete(answer(loaded, "income", "200-300k")), true);
});

test("seven answers round-trip and forged completion or invalid goal fields cannot skip missing questions", () => {
  const state = completeState(), local = storage();
  assert.equal(persistOnboarding(state, local), true);
  assert.deepEqual(loadOnboarding(local), state);
  local.setItem(ONBOARDING_KEY, JSON.stringify({ ...state, completed: true, answers: { ...state.answers, goal12Months: " ", skills: 123 } }));
  const loaded = loadOnboarding(local);
  assert.equal(loaded.answers.goal12Months, undefined);
  assert.equal(loaded.answers.skills, undefined);
  assert.equal(loaded.answers.challenge, state.answers.challenge);
  assert.equal(resumeRoute(loaded), "onboarding/goal");
  assert.equal(onboardingComplete(loaded), false);
});

test("free-text role is required, Unicode-safe and independent of employee or owner status", () => {
  const base = industryState();
  for (const value of [undefined, "", "  ", 123, "x".repeat(121)]) {
    assert.ok(answerQuestion(base, "role", value).error);
    assert.equal(base.answers.role, undefined);
  }
  const state = answer(base, "role", "  Head of Marketing / 市场总监  ");
  assert.equal(state.answers.role, "Head of Marketing / 市场总监");
  assert.equal(state.answers.occupation, undefined);
  assert.equal(resumeRoute(state), "onboarding/occupation");
  assert.ok(answerQuestion(base, "occupation", "employee").error);
  assert.ok(answerQuestion(base, "income", "100-200k").error);
});

test("legacy six-answer profiles retain every answer and request the missing role", () => {
  const original = completeState(), legacy = structuredClone(original);
  delete legacy.answers.role;
  const loaded = loadOnboarding(storage(JSON.stringify(legacy)));
  assert.deepEqual(loaded, legacy);
  assert.equal(onboardingComplete(loaded), false);
  assert.equal(resumeRoute(loaded), "onboarding/role");
  for (const route of ["occupation", "income", "goal", "complete"]) assert.equal(stepForRoute("#onboarding/" + route, loaded), "role");
  const updated = answer(loaded, "role", "Founder");
  assert.deepEqual(updated.answers, {...legacy.answers, role:"Founder"});
  assert.equal(onboardingComplete(updated), true);
});

test("editing a role preserves work type, income and all ambition answers", () => {
  const original = completeState();
  const changed = answer(original, "role", "Managing director");
  assert.deepEqual(changed.answers, {...original.answers, role:"Managing director"});
  assert.deepEqual(loadOnboarding(storage(JSON.stringify(changed))), changed);
});

test("question counts follow four world questions then three ambition questions", () => {
  for (const [index,step] of ["industry","role","occupation","income"].entries()) assert.deepEqual(questionProgress(step), {stage:1,number:index+1,total:4});
  for (const [index,step] of ["goal","challenge","skills"].entries()) assert.deepEqual(questionProgress(step), {stage:2,number:index+1,total:3});
});
