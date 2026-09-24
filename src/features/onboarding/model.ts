// Ported from the current workspace app/onboarding-model.js (not the older archived prototype).
export const STORAGE_KEY = 'master-app.native.onboarding.v1';
export const LONG_ANSWER_LIMIT = 1000;
export const ownershipOptions = [
  { value: 'find-business', label: 'Find a business to buy' },
  { value: 'buy-specific', label: 'Buy a specific business' },
  { value: 'grow-business', label: 'Grow a business I already own' },
  { value: 'explore-options', label: 'Explore my options' },
] as const;
export const roleOptions = [
  { value: 'run-business', label: 'I run the business', description: 'Founder, owner, operator' },
  {
    value: 'make-decisions',
    label: 'I make the decisions',
    description: 'Executive, manager, business leader',
  },
  {
    value: 'advise-business',
    label: 'I advise the business',
    description: 'Consultant, advisor, professional',
  },
  {
    value: 'build-business',
    label: 'I build for the business',
    description: 'Specialist, designer, developer, marketer',
  },
  {
    value: 'preparing-owner',
    label: "I'm preparing to become an owner",
    description: 'Exploring business ownership',
  },
] as const;
export const incomeRanges = {
  employee: ['100-200k', '200-300k', '300k+'],
  'business-owner': ['0-100k', '100-500k', '500k-1m', '1m+'],
} as const;
export const questions = [
  'decision',
  'industry',
  'role',
  'income',
  'goal',
  'challenge',
  'skills',
] as const;
export type Question = (typeof questions)[number];
export type Step = 'welcome' | Question | 'complete';
export const fields = {
  decision: 'ownershipIntent',
  industry: 'industry',
  role: 'rolePerspective',
  income: 'incomeRange',
  goal: 'goal12Months',
  challenge: 'challenge',
  skills: 'skills',
} as const;
type AnswerKey = (typeof fields)[Question] | 'role' | 'occupation';
export type OnboardingRecord = { version: 1; answers: Partial<Record<AnswerKey, string>> };
export const emptyRecord = (): OnboardingRecord => ({ version: 1, answers: {} });
export const isQuestion = (value: unknown): value is Question =>
  questions.some((step) => step === value);
export const validText = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit;
const validRole = (value: unknown) => roleOptions.some((option) => option.value === value);
const validIntent = (value: unknown) => ownershipOptions.some((option) => option.value === value);
export const incomeTypeFor = (role: unknown) =>
  validRole(role) ? (role === 'run-business' ? 'business-owner' : 'employee') : null;
export function rangesFor(type: unknown): readonly string[] {
  return type === 'employee' || type === 'business-owner' ? incomeRanges[type] : [];
}
export const formatIncome = (value: string) => `$${value.replaceAll('m', 'M')}`;
export function hasAnswer(record: OnboardingRecord, step: Question) {
  const a = record.answers;
  if (step === 'decision') return validIntent(a.ownershipIntent);
  if (step === 'industry') return validText(a.industry, 120);
  if (step === 'role') return validRole(a.rolePerspective);
  if (step === 'income')
    return rangesFor(incomeTypeFor(a.rolePerspective)).includes(a.incomeRange ?? '');
  return validText(a[fields[step]], LONG_ANSWER_LIMIT);
}
export const isComplete = (record: OnboardingRecord) =>
  questions.every((step) => hasAnswer(record, step));
export function resumeStep(record: OnboardingRecord): Step {
  const missing = questions.find((step) => !hasAnswer(record, step));
  if (missing === 'decision' && !questions.slice(1).some((step) => hasAnswer(record, step)))
    return 'welcome';
  return missing ?? 'complete';
}
export function guardedStep(requested: unknown, record: OnboardingRecord): Step {
  if (!requested) return resumeStep(record);
  if (requested === 'welcome') return 'welcome';
  const canonical = requested === 'occupation' ? 'income' : requested;
  if (!isQuestion(canonical) && canonical !== 'complete') return resumeStep(record);
  const position = canonical === 'complete' ? questions.length : questions.indexOf(canonical);
  return questions.slice(0, position).find((step) => !hasAnswer(record, step)) ?? canonical;
}
export function answerQuestion(record: OnboardingRecord, step: Question, value: unknown) {
  const fail = (error: string) => ({ record, error });
  if (!isQuestion(step)) return fail('Choose an available question.');
  const missing = questions
    .slice(0, questions.indexOf(step))
    .find((previous) => !hasAnswer(record, previous));
  if (missing) return fail('Answer the previous questions first.');
  if (step === 'decision' && !validIntent(value)) return fail('Choose an option to continue.');
  if (step === 'role' && !validRole(value))
    return fail('Choose the role that best describes you to continue.');
  if (
    step === 'income' &&
    (typeof value !== 'string' ||
      !rangesFor(incomeTypeFor(record.answers.rolePerspective)).includes(value))
  )
    return fail('Choose one range to continue.');
  if (['industry', 'goal', 'challenge', 'skills'].includes(step)) {
    const limit = step === 'industry' ? 120 : LONG_ANSWER_LIMIT;
    if (typeof value !== 'string' || !value.trim())
      return fail(
        {
          industry: 'Enter your current industry to continue.',
          goal: 'Describe your goal for the next 12 months to continue.',
          challenge: 'Tell us what’s standing in your way to continue.',
          skills: 'Tell us which skills you want to develop to finish.',
        }[step as 'industry' | 'goal' | 'challenge' | 'skills'],
      );
    if (value.trim().length > limit)
      return fail(`Keep your answer to ${limit} characters or fewer.`);
  }
  const answers = { ...record.answers, [fields[step]]: (value as string).trim() };
  if (step === 'role' && !rangesFor(incomeTypeFor(value)).includes(answers.incomeRange ?? ''))
    delete answers.incomeRange;
  return { record: { version: 1 as const, answers }, error: '' };
}

// Preserve valid historical data while asking for missing current choices. Never infer a role.
export function sanitizeRecord(raw: unknown): OnboardingRecord {
  const result = emptyRecord();
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('version' in raw) ||
    raw.version !== 1 ||
    !('answers' in raw) ||
    !raw.answers ||
    typeof raw.answers !== 'object'
  )
    return result;
  const a = raw.answers as Record<string, unknown>;
  if (validIntent(a.ownershipIntent)) result.answers.ownershipIntent = a.ownershipIntent as string;
  if (validText(a.industry, 120)) {
    result.answers.industry = a.industry.trim();
    if (validText(a.role, 120)) result.answers.role = a.role.trim();
    if (validRole(a.rolePerspective)) result.answers.rolePerspective = a.rolePerspective as string;
    if (a.occupation === 'employee' || a.occupation === 'business-owner')
      result.answers.occupation = a.occupation;
    const type = incomeTypeFor(result.answers.rolePerspective) ?? result.answers.occupation;
    if (typeof a.incomeRange === 'string' && rangesFor(type).includes(a.incomeRange))
      result.answers.incomeRange = a.incomeRange;
  }
  for (const field of ['goal12Months', 'challenge', 'skills'] as const) {
    if (validText(a[field], LONG_ANSWER_LIMIT)) result.answers[field] = a[field].trim();
  }
  return result;
}
export const summaryLabels: Record<Question, string> = {
  decision: 'Your first decision',
  industry: 'Your industry',
  role: 'Your role',
  income: 'Your starting point',
  goal: 'Your 12-month goal',
  challenge: 'Your biggest challenge',
  skills: 'Skills you want to develop',
};
export function displayAnswer(record: OnboardingRecord, question: Question) {
  const value = record.answers[fields[question]] ?? '';
  if (question === 'decision')
    return ownershipOptions.find((option) => option.value === value)?.label ?? '';
  if (question === 'role') return roleOptions.find((option) => option.value === value)?.label ?? '';
  return question === 'income' && value ? formatIncome(value) : value;
}
export function questionCopy(step: Question, record: OnboardingRecord) {
  const owner = incomeTypeFor(record.answers.rolePerspective) === 'business-owner';
  const copy = {
    decision: {
      title: 'What are you looking to do?',
      intro: 'Choose the direction you want to explore.',
      button: 'Continue',
    },
    industry: {
      title: 'What industry are you looking to build, buy, or grow in?',
      intro: 'Tell us your current or future industry.',
      button: 'Set my focus',
      placeholder: 'e.g. Technology, property, hospitality',
    },
    role: {
      title: 'Which best describes the role you play today?',
      intro: 'Choose the perspective that best describes you.',
      button: 'Set my perspective',
    },
    income: {
      title: owner
        ? 'What does your business look like today?'
        : 'What does your current earning power look like?',
      intro: owner ? 'Choose your annual revenue range.' : 'Choose your annual income range.',
      button: 'Set my starting point',
    },
    goal: {
      title: 'What would make the next year a success?',
      intro: 'Take a moment to picture yourself 12 months from now.',
      button: 'Set my goal',
      placeholder: 'Write your vision…',
    },
    challenge: {
      title: 'What stands between you and your goal?',
      intro: 'What’s the biggest thing you need to overcome?',
      button: 'Identify my obstacles',
      placeholder: 'Tell us what’s in the way…',
    },
    skills: {
      title: 'What do you want to get better at?',
      intro: 'What will you learn to move forward?',
      button: 'Review my direction',
      placeholder: 'Tell us what you’ll build…',
    },
  };
  return copy[step];
}
export function progressLabel(step: Question) {
  const index = questions.indexOf(step);
  if (index === 0) return 'Your first decision';
  return `Stage ${index < 4 ? 1 : 2} of 2 · ${index < 4 ? 'Your world' : 'Your ambition'} · Question ${index < 4 ? index : index - 3} of 3`;
}
