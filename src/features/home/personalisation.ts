import { displayAnswer, isComplete, type OnboardingRecord } from '../onboarding/model';
import type { Goal } from './model';

export const directionSignature = (record: OnboardingRecord) => JSON.stringify(record);
export function goalFromOnboarding(record: OnboardingRecord): Goal | null {
  if (!isComplete(record)) return null;
  const outcome = record.answers.goal12Months!.trim();
  return {
    name: outcome.slice(0, 120),
    success: outcome,
    weeks: '52',
    context: [
      record.answers.challenge,
      record.answers.skills,
      record.answers.industry,
      displayAnswer(record, 'decision'),
      displayAnswer(record, 'role'),
    ]
      .filter(Boolean)
      .join(' '),
  };
}
export function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length
    ? [words[0], ...(words.length > 1 ? [words.at(-1)!] : [])]
        .map((word) => Array.from(word)[0])
        .join('')
        .toUpperCase()
    : 'M';
}
