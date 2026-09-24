import { describe, expect, it, jest } from '@jest/globals';
import {
  canWatch,
  consultationGoal,
  createMember,
  getDashboard,
  lessons,
  watchedSeconds,
} from './model';
import { canAttend, eventCatalogue, eventStatus, nextEvent } from './events';
import { createMemberStore, MEMBER_KEY } from './store';
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
describe('Migrated Home rules', () => {
  it('retains the reference returning-member figures and continuation', () => {
    const d = getDashboard(createMember(), consultationGoal);
    expect([d.coursePercent, d.weeklyMinutes, d.actionsDone]).toEqual([33, 26, 1]);
    expect(d.next.label).toBe('Continue learning');
    expect(d.nextLesson.id).toBe('blueprint');
    expect(d.recommendations.map((l) => l.id)).toEqual(['rhythm', 'review']);
  });
  it('matches the screenshot’s Start learning state when there is no partly watched lesson', () => {
    const member = createMember();
    delete member.positions.blueprint;
    const d = getDashboard(member, consultationGoal);
    expect(d.next.label).toBe('Start learning');
    expect(d.nextLesson.id).toBe('rhythm');
    expect([d.coursePercent, d.weeklyMinutes, d.actionsDone]).toEqual([33, 26, 1]);
  });
  it('uses real access and completion for next actions instead of fixed percentages', () => {
    const member = createMember(true, 'paused');
    expect(lessons.filter((l) => canWatch(member, l))).toHaveLength(3);
    member.completed = ['direction', 'priorities', 'rhythm'];
    member.weeklyCompleted = ['rhythm'];
    expect(getDashboard(member, consultationGoal).next.kind).toBe('focus');
    member.focusDone = true;
    expect(getDashboard(member, consultationGoal).next.kind).toBe('reflection');
    member.reflectionDone = true;
    expect(getDashboard(member, consultationGoal).next.kind).toBe('progress');
    expect(getDashboard(member, consultationGoal).coursePercent).toBe(100);
  });
  it('does not count seek jumps, backwards playback or background time as learning', () => {
    expect(watchedSeconds(10, 11, 1)).toBe(1);
    expect(watchedSeconds(10, 40, 1)).toBe(0);
    expect(watchedSeconds(10, 9, 1)).toBe(0);
    expect(watchedSeconds(10, 20, 10)).toBe(0);
  });
  it('retains event eligibility, full/cancelled states and registered-event priority', () => {
    const member = createMember();
    const events = eventCatalogue('2026-09-23');
    const now = Date.parse('2026-09-23');
    expect(nextEvent(member, '2026-09-23', {}, now)?.title).toBe('Focus into action');
    expect(eventStatus(events[2], {}, now)).toBe('Fully booked');
    expect(canAttend(member, events[3])).toBe(false);
    expect(eventStatus(events[4], {}, now)).toBe('Cancelled');
    expect(nextEvent(member, '2026-09-23', { [events[1].id]: 'registered' }, now)?.id).toBe(
      events[1].id,
    );
  });
});
describe('Home persistence', () => {
  function disk() {
    const values: Record<string, string> = {};
    return {
      getItem: jest.fn(async (key: string) => values[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values[key] = value;
      }),
    };
  }
  it('blocks unread data, retries a failed read and preserves failed note drafts', async () => {
    const storage = disk();
    storage.getItem.mockRejectedValueOnce(new Error('offline'));
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    expect(await store.getState().saveNote('focus', 'No overwrite')).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    await store.getState().hydrate();
    storage.setItem.mockRejectedValueOnce(new Error('full'));
    expect(await store.getState().saveNote('focus', 'Meet a founder')).toBe(false);
    expect(store.getState().data.member.focusDone).toBe(false);
    expect(await store.getState().saveNote('focus', 'Meet a founder')).toBe(true);
    const restored = createMemberStore(storage);
    await restored.getState().hydrate();
    expect(restored.getState().data.member.focusNote).toBe('Meet a founder');
    expect(getDashboard(restored.getState().data.member, consultationGoal).actionsDone).toBe(2);
  });
  it('persists lesson completion and plan changes and guards locked lessons', async () => {
    const storage = disk();
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    await store.getState().preset('essentials', 'new');
    expect(await store.getState().complete('blueprint')).toBe(false);
    await store.getState().complete('rhythm');
    await store.getState().complete('rhythm');
    expect(store.getState().data.member.weeklyCompleted).toEqual(['rhythm']);
    expect(await store.getState().saveGoal({ name: '', success: '', weeks: '3' })).toBe(false);
    expect(
      await store
        .getState()
        .saveGoal({ name: 'Lead a team', success: 'Delegate clearly', weeks: '8' }),
    ).toBe(true);
    const persisted = JSON.parse((await storage.getItem(MEMBER_KEY))!);
    expect(persisted.goal.name).toBe('Lead a team');
    expect(persisted.member.completed).toEqual(['rhythm']);
  });
  it('does not overwrite pending lesson completion when the player loses focus', async () => {
    const storage = disk();
    const store = createMemberStore(storage);
    await store.getState().hydrate();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = storage.setItem.getMockImplementation()!;
    storage.setItem.mockImplementationOnce(async (key, value) => {
      await pending;
      await write(key, value);
    });
    const completion = store.getState().complete('blueprint');
    const blurSave = store.getState().savePlayback();
    release();
    await Promise.all([completion, blurSave]);
    const persisted = JSON.parse((await storage.getItem(MEMBER_KEY))!);
    expect(persisted.member.completed).toContain('blueprint');
  });
});
