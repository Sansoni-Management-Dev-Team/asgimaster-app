import { describe, expect, it, jest } from '@jest/globals';
import {
  answerQuestion,
  emptyRecord,
  guardedStep,
  isComplete,
  ownershipOptions,
  resumeStep,
  sanitizeRecord,
  STORAGE_KEY,
  type OnboardingRecord,
} from './model';
import { createOnboardingStore } from './store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const complete = (): OnboardingRecord => ({
  version: 1,
  answers: {
    ownershipIntent: 'find-business',
    industry: 'Technology',
    rolePerspective: 'build-business',
    incomeRange: '200-300k',
    goal12Months: 'Buy a sustainable business',
    challenge: 'Finding the right team',
    skills: 'Leadership\nFinancial planning',
  },
});

function memoryStorage(initial: string | null = null) {
  let raw = initial;
  return {
    getItem: jest.fn(async (_key: string) => raw),
    setItem: jest.fn(async (_key: string, value: string) => {
      raw = value;
    }),
    read: () => raw,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('Onboarding validation and branching', () => {
  it.each(ownershipOptions)(
    'accepts the $value direction without mutating prior answers',
    (option) => {
      const original = emptyRecord();
      const result = answerQuestion(original, 'decision', option.value);
      expect(result.error).toBe('');
      expect(result.record.answers.ownershipIntent).toBe(option.value);
      expect(original.answers).toEqual({});
    },
  );

  it('rejects unknown choices and bypassing prerequisite questions', () => {
    expect(answerQuestion(emptyRecord(), 'decision', 'something-else').error).toBeTruthy();
    expect(answerQuestion(emptyRecord(), 'skills', 'Leadership').error).toMatch(/previous/);
    expect(answerQuestion(complete(), 'role', 'business-owner').error).toBeTruthy();
    expect(answerQuestion(complete(), 'income', '1m+').error).toBeTruthy();
  });

  it.each(['industry', 'goal', 'challenge', 'skills'] as const)(
    'validates %s without changing saved data',
    (step) => {
      const record = complete();
      expect(answerQuestion(record, step, ' \n ').error).toBeTruthy();
      const limit = step === 'industry' ? 120 : 1000;
      expect(answerQuestion(record, step, 'x'.repeat(limit + 1)).error).toMatch(/characters/);
      expect(answerQuestion(record, step, 'x'.repeat(limit)).error).toBe('');
      expect(record).toEqual(complete());
    },
  );

  it('preserves Unicode, punctuation and multiline answers as text', () => {
    const result = answerQuestion(
      complete(),
      'skills',
      '  财务规划 — leadership\n<script>plain text</script>  ',
    );
    expect(result.record.answers.skills).toBe('财务规划 — leadership\n<script>plain text</script>');
  });

  it('retains goals but requires compatible income after an owner-role change', () => {
    const original = complete();
    const changed = answerQuestion(original, 'role', 'run-business').record;
    expect(changed.answers.incomeRange).toBeUndefined();
    expect(changed.answers.goal12Months).toBe(original.answers.goal12Months);
    expect(changed.answers.skills).toBe(original.answers.skills);
    expect(original.answers.incomeRange).toBe('200-300k');
    expect(isComplete(changed)).toBe(false);
    expect(resumeStep(changed)).toBe('income');
    expect(isComplete(answerQuestion(changed, 'income', '500k-1m').record)).toBe(true);
  });

  it('keeps income and goals when roles share an income branch', () => {
    const result = answerQuestion(complete(), 'role', 'advise-business').record;
    expect(result.answers.incomeRange).toBe('200-300k');
    expect(isComplete(result)).toBe(true);
  });

  it('guards direct links while allowing earlier answers to be revisited', () => {
    const record = complete();
    delete record.answers.challenge;
    expect(guardedStep('complete', record)).toBe('challenge');
    expect(guardedStep('skills', record)).toBe('challenge');
    expect(guardedStep('role', record)).toBe('role');
    expect(guardedStep('occupation', record)).toBe('income');
    expect(guardedStep('unknown-route', record)).toBe('challenge');
    expect(guardedStep(undefined, emptyRecord())).toBe('welcome');
    expect(guardedStep(undefined, complete())).toBe('complete');
  });

  it('restores legacy fields without inventing ownership intent or role choices', () => {
    const record = sanitizeRecord({
      version: 1,
      answers: {
        industry: ' Hospitality ',
        role: ' General manager ',
        occupation: 'employee',
        incomeRange: '100-200k',
        goal12Months: 'Expand the team',
        skills: 'Mentoring',
        unknown: 'discard',
      },
    });
    expect(record.answers.role).toBe('General manager');
    expect(record.answers.occupation).toBe('employee');
    expect(record.answers.incomeRange).toBe('100-200k');
    expect(record.answers.rolePerspective).toBeUndefined();
    expect(resumeStep(record)).toBe('decision');
    expect(record.answers).not.toHaveProperty('unknown');
  });

  it('drops malformed values and incompatible saved income', () => {
    const record = complete();
    const restored = sanitizeRecord({
      version: 1,
      answers: {
        ...record.answers,
        industry: 'x'.repeat(121),
        challenge: false,
        skills: ['Leadership'],
      },
    });
    expect(restored.answers.industry).toBeUndefined();
    expect(restored.answers.rolePerspective).toBeUndefined();
    expect(restored.answers.skills).toBeUndefined();
    expect(restored.answers.goal12Months).toBe(record.answers.goal12Months);
    expect(sanitizeRecord({ version: 2, answers: record.answers })).toEqual(emptyRecord());
    expect(
      sanitizeRecord({ version: 1, answers: { ...record.answers, incomeRange: '1m+' } }).answers
        .incomeRange,
    ).toBeUndefined();
  });
});

describe('Device-local saved progress', () => {
  it('deduplicates loading and prevents writes until hydration finishes', async () => {
    const read = deferred<string | null>();
    const storage = memoryStorage();
    storage.getItem.mockReturnValueOnce(read.promise);
    const store = createOnboardingStore(storage);
    const first = store.getState().hydrate();
    const second = store.getState().hydrate();
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect((await store.getState().submit('decision', 'find-business')).ok).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    read.resolve(JSON.stringify(complete()));
    await Promise.all([first, second]);
    expect(store.getState().record).toEqual(complete());
    expect(store.getState().drafts.skills).toBe('Leadership\nFinancial planning');
    expect(store.getState().enteredApp).toBe(true);
  });

  it('blocks writes after a failed read and can retry without losing saved progress', async () => {
    const storage = memoryStorage(JSON.stringify(complete()));
    storage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
    const store = createOnboardingStore(storage);
    await store.getState().hydrate();
    expect(store.getState().hydration).toBe('failed');
    expect((await store.getState().submit('decision', 'grow-business')).ok).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    await store.getState().hydrate();
    expect(store.getState().hydration).toBe('ready');
    expect(store.getState().record).toEqual(complete());
  });

  it.each(['{broken json', '{"version":99}', '{"version":1,"answers":null}'])(
    'recovers unreadable progress with an explicit notice: %s',
    async (raw) => {
      const storage = memoryStorage(raw);
      const store = createOnboardingStore(storage);
      await store.getState().hydrate();
      expect(store.getState().notice).toMatch(/could not be read/);
      expect(store.getState().record).toEqual(emptyRecord());
      expect(storage.read()).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('keeps the saved record and draft intact when saving fails, then retries', async () => {
    const storage = memoryStorage(JSON.stringify(complete()));
    const store = createOnboardingStore(storage);
    await store.getState().hydrate();
    store.getState().setDraft('industry', 'Healthcare');
    storage.setItem.mockRejectedValueOnce(new Error('Storage full'));
    const result = await store.getState().submit('industry', 'Healthcare');
    expect(result).toMatchObject({ ok: false, storage: true });
    expect(store.getState().record).toEqual(complete());
    expect(store.getState().drafts.industry).toBe('Healthcare');
    expect(JSON.parse(storage.read()!)).toEqual(complete());
    expect(store.getState().saving).toBe(false);
    expect((await store.getState().submit('industry', 'Healthcare')).ok).toBe(true);
    expect(store.getState().record.answers.industry).toBe('Healthcare');
    expect(storage.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, expect.any(String));
  });

  it('serializes saves and commits only after the write succeeds', async () => {
    const write = deferred<void>();
    const storage = memoryStorage();
    storage.setItem.mockReturnValueOnce(write.promise);
    const store = createOnboardingStore(storage);
    await store.getState().hydrate();
    const first = store.getState().submit('decision', 'find-business');
    expect(store.getState().saving).toBe(true);
    expect(store.getState().record).toEqual(emptyRecord());
    expect((await store.getState().submit('decision', 'grow-business')).ok).toBe(false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    write.resolve();
    expect((await first).ok).toBe(true);
    expect(store.getState().record.answers.ownershipIntent).toBe('find-business');
  });

  it('restores committed progress across app instances, never unsubmitted drafts', async () => {
    const storage = memoryStorage();
    const original = createOnboardingStore(storage);
    await original.getState().hydrate();
    await original.getState().submit('decision', 'grow-business');
    original.getState().setDraft('industry', 'Unsaved text');
    const restored = createOnboardingStore(storage);
    await restored.getState().hydrate();
    expect(resumeStep(restored.getState().record)).toBe('industry');
    expect(restored.getState().drafts.industry).toBe('');
  });

  it('cancels drafts and persists role changes without erasing later answers', async () => {
    const storage = memoryStorage(JSON.stringify(complete()));
    const store = createOnboardingStore(storage);
    await store.getState().hydrate();
    store.getState().setDraft('goal', 'Discard me');
    store.getState().cancelDraft('goal');
    expect(store.getState().drafts.goal).toBe(complete().answers.goal12Months);
    await store.getState().submit('role', 'run-business');
    expect(store.getState().drafts.income).toBe('');
    const restored = createOnboardingStore(storage);
    await restored.getState().hydrate();
    expect(resumeStep(restored.getState().record)).toBe('income');
    expect(restored.getState().record.answers.skills).toBe(complete().answers.skills);
  });
});
