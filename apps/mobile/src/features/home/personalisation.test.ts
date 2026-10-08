import { describe, expect, it, jest } from '@jest/globals';
import { createMemberStore, MEMBER_KEY } from './store';
import { createMember, consultationGoal, getDashboard } from './model';
import { goalFromOnboarding, initialsFor } from './personalisation';
import { createOnboardingStore } from '../onboarding/store';
import { emptyRecord, type OnboardingRecord } from '../onboarding/model';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
const direction = (): OnboardingRecord => ({
  version: 1,
  name: 'Alex Morgan',
  answers: {
    ownershipIntent: 'grow-business',
    industry: 'Technology',
    rolePerspective: 'run-business',
    incomeRange: '100-500k',
    goal12Months: 'Build a team',
    challenge: 'Delegate ownership',
    skills: 'Leadership',
  },
});
function disk() {
  const values: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => values[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values[key] = value;
    }),
  };
}
describe('First-run personalisation', () => {
  it('starts empty, persists the member’s own direction, and ranks learning without awarding progress', async () => {
    const storage = disk();
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    expect(store.getState().data.goal.name).toBe('');
    expect(store.getState().data.member.firstName).toBe('');
    expect(goalFromOnboarding(emptyRecord())).toBeNull();
    await store.getState().syncOnboarding(direction());
    const restored = createMemberStore(storage);
    await restored.getState().hydrate();
    const { member, goal } = restored.getState().data;
    expect([member.firstName, member.initials, goal.name, goal.weeks]).toEqual([
      'Alex Morgan',
      'AM',
      'Build a team',
      '52',
    ]);
    const dashboard = getDashboard(member, goal);
    expect([dashboard.coursePercent, dashboard.weeklyMinutes, dashboard.actionsDone]).toEqual([
      0, 0, 0,
    ]);
    expect(dashboard.nextLesson.id).toBe('delegate');
    expect(member.membership).toBe('growth');
    const writes = storage.setItem.mock.calls.length;
    await restored.getState().syncOnboarding(direction());
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
  });
  it('migrates the old sample goal while preserving saved activity, notes and membership', async () => {
    const storage = disk();
    const member = createMember(false, 'payment');
    await storage.setItem(
      MEMBER_KEY,
      JSON.stringify({ version: 1, member, goal: consultationGoal }),
    );
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    await store.getState().syncOnboarding(direction());
    expect(store.getState().data.goal.name).toBe('Build a team');
    expect(store.getState().data.member).toEqual({
      ...member,
      firstName: 'Alex Morgan',
      initials: 'AM',
    });
  });
  it('updates edited answers and keeps an explicitly customised plan', async () => {
    const store = createMemberStore(disk());
    await store.getState().hydrate();
    await store.getState().syncOnboarding(direction());
    const edited = direction();
    edited.answers.goal12Months = 'A clear strategy';
    edited.answers.challenge = 'Choose priorities';
    edited.answers.skills = 'Strategic thinking';
    await store.getState().syncOnboarding(edited);
    expect(store.getState().data.goal.name).toBe('A clear strategy');
    expect(
      getDashboard(store.getState().data.member, store.getState().data.goal).nextLesson.id,
    ).toBe('priorities');
    await store
      .getState()
      .saveGoal({ name: 'A focused month', success: 'Finish a project', weeks: '4' });
    await store.getState().syncOnboarding(direction());
    expect(store.getState().data.goal).toMatchObject({
      name: 'A focused month',
      success: 'Finish a project',
      weeks: '4',
    });
    expect(store.getState().data.goal.context).toContain('Leadership');
  });
  it('keeps the old state if saving fails, then retries safely', async () => {
    const storage = disk();
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    storage.setItem.mockRejectedValueOnce(new Error('Full'));
    expect(await store.getState().syncOnboarding(direction())).toBe(false);
    expect(store.getState().data.goal.name).toBe('');
    expect(store.getState().data.onboardingSignature).toBeUndefined();
    expect(await store.getState().syncOnboarding(direction())).toBe(true);
    expect(store.getState().data.goal.name).toBe('Build a team');
  });
  it('saves the invitation name with the first answer and restores it after reload', async () => {
    const storage = disk();
    const store = createOnboardingStore(storage);
    await store.getState().hydrate();
    store.getState().setName('  Alex   Morgan  ');
    await store.getState().submit('decision', 'grow-business');
    const restored = createOnboardingStore(storage);
    await restored.getState().hydrate();
    expect(restored.getState().record.name).toBe('Alex Morgan');
    expect(restored.getState().nameDraft).toBe('Alex Morgan');
    expect(initialsFor('杨山')).toBe('杨');
  });
});
