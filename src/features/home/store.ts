import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  canWatch,
  consultationGoal,
  createMember,
  lessons,
  memberships,
  type Goal,
  type Member,
  type Membership,
} from './model';
import { canAttend, eventCatalogue, eventStatus, type Registrations } from './events';
import { FOCUS_KEY } from './focus-store';
import type { OnboardingRecord } from '../onboarding/model';
import { directionSignature, goalFromOnboarding, initialsFor } from './personalisation';
import {
  createMembershipCard,
  isMembershipCard,
  readMembershipCard,
  type MembershipCard,
} from './membership-card';

export const MEMBER_KEY = 'master-app.native.member.v1';
type Data = {
  version: 1;
  member: Member;
  membershipCard: MembershipCard;
  goal: Goal;
  eventAnchor: string;
  registrations: Registrations;
  onboardingSignature?: string;
  goalSource?: 'onboarding' | 'custom';
};
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
const freshData = (): Data => ({
  version: 1,
  member: createMember(true),
  membershipCard: createMembershipCard(),
  goal: { name: '', success: '', weeks: '52' },
  goalSource: 'onboarding',
  eventAnchor: new Date().toISOString().slice(0, 10),
  registrations: {},
});
const note = (value: unknown, limit = 400) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : '';
function restore(raw: unknown): Data {
  const clean = freshData();
  if (!raw || typeof raw !== 'object') return clean;
  const data = raw as Partial<Data>;
  if (data.version !== 1 || !data.member) return clean;
  const card = readMembershipCard(data.membershipCard);
  if (card) clean.membershipCard = card;
  const m = data.member;
  clean.member = createMember(
    true,
    Object.hasOwn(memberships, m.membership) ? m.membership : 'growth',
  );
  clean.member.firstName = note(m.firstName, 80);
  clean.member.initials = note(m.initials, 4) || initialsFor(clean.member.firstName);
  const ids = lessons.map((l) => l.id);
  clean.member.completed = [
    ...new Set((Array.isArray(m.completed) ? m.completed : []).filter((id) => ids.includes(id))),
  ];
  clean.member.weeklyCompleted = [
    ...new Set(
      (Array.isArray(m.weeklyCompleted) ? m.weeklyCompleted : []).filter((id) =>
        clean.member.completed.includes(id),
      ),
    ),
  ];
  for (const lesson of lessons) {
    const pos = m.positions?.[lesson.id];
    if (typeof pos === 'number' && Number.isFinite(pos))
      clean.member.positions[lesson.id] = Math.max(0, Math.min(pos, lesson.minutes * 60));
  }
  clean.member.weeklyMinutes = Number.isFinite(m.weeklyMinutes)
    ? Math.max(0, Math.min(m.weeklyMinutes, 10080))
    : 0;
  clean.member.focusNote = note(m.focusNote);
  clean.member.reflectionNote = note(m.reflectionNote);
  clean.member.focusDone = Boolean(clean.member.focusNote);
  clean.member.reflectionDone = Boolean(clean.member.reflectionNote);
  if (
    data.goal &&
    note(data.goal.name, 120) &&
    note(data.goal.success, 1000) &&
    ['4', '8', '12', '26', '52'].includes(data.goal.weeks)
  )
    clean.goal = {
      name: note(data.goal.name, 120),
      success: note(data.goal.success, 1000),
      weeks: data.goal.weeks,
      ...(typeof data.goal.context === 'string' ? { context: note(data.goal.context, 2500) } : {}),
    };
  clean.goalSource =
    data.goalSource === 'custom' ||
    (!data.goalSource && clean.goal.name && clean.goal.name !== consultationGoal.name)
      ? 'custom'
      : 'onboarding';
  if (typeof data.onboardingSignature === 'string')
    clean.onboardingSignature = data.onboardingSignature;
  if (
    typeof data.eventAnchor === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.eventAnchor) &&
    Number.isFinite(Date.parse(data.eventAnchor))
  )
    clean.eventAnchor = data.eventAnchor;
  const eventIds = eventCatalogue(clean.eventAnchor).map((e) => e.id);
  for (const [id, status] of Object.entries(data.registrations ?? {}))
    if (eventIds.includes(id) && ['registered', 'cancelled'].includes(status))
      clean.registrations[id] = status;
  return clean;
}
type State = {
  data: Data;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  saving: boolean;
  error: string;
  notice: string;
  now: number;
  hydrate: () => Promise<void>;
  syncOnboarding: (record: OnboardingRecord) => Promise<boolean>;
  clearError: () => void;
  saveNote: (kind: 'focus' | 'reflection', value: string) => Promise<boolean>;
  saveGoal: (goal: Goal) => Promise<boolean>;
  preset: (membership: Membership, progress: string) => Promise<boolean>;
  complete: (id: string) => Promise<boolean>;
  watch: (id: string, position: number, elapsed: number) => void;
  savePlayback: () => Promise<void>;
  register: (id: string, cancel?: boolean) => Promise<boolean>;
};
export function createMemberStore(storage: Storage) {
  let writing: Promise<void> = Promise.resolve();
  const write = (data: Data) => {
    const value = JSON.stringify(data);
    const job = writing.catch(() => {}).then(() => storage.setItem(MEMBER_KEY, value));
    writing = job;
    return job;
  };
  return create<State>((set, get) => {
    async function commit(update: (data: Data) => void, notice: string) {
      if (get().status !== 'ready' || get().saving) return false;
      const data = JSON.parse(JSON.stringify(get().data)) as Data;
      update(data);
      set({ saving: true, error: '', notice: '' });
      try {
        await write(data);
        set({ data, notice });
        return true;
      } catch {
        set({ error: 'Your changes could not be saved. Please try again.' });
        return false;
      } finally {
        set({ saving: false });
      }
    }
    return {
      data: freshData(),
      status: 'idle',
      saving: false,
      error: '',
      notice: '',
      now: 0,
      clearError: () => set({ error: '' }),
      async syncOnboarding(record) {
        const goal = goalFromOnboarding(record);
        if (!goal || get().data.onboardingSignature === directionSignature(record)) return true;
        return commit((data) => {
          data.goal = data.goalSource === 'custom' ? { ...data.goal, context: goal.context } : goal;
          data.onboardingSignature = directionSignature(record);
          if (record.name) {
            data.member.firstName = record.name;
            data.member.initials = initialsFor(record.name);
          }
        }, 'Your Home now reflects your direction.');
      },
      async hydrate() {
        if (get().status === 'loading' || get().status === 'ready') return;
        set({ status: 'loading', error: '' });
        try {
          const raw = await storage.getItem(MEMBER_KEY);
          let data = freshData();
          let hasSavedCard = false;
          let migratedData: Data | undefined;
          if (raw) {
            try {
              const saved = JSON.parse(raw);
              data = restore(saved);
              hasSavedCard =
                saved?.version === 1 &&
                Boolean(saved.member) &&
                isMembershipCard(saved.membershipCard);
              const card = readMembershipCard(saved?.membershipCard);
              if (saved?.version === 1 && saved.member && card && !hasSavedCard) {
                // Change only the code on disk; retain all original member and card fields.
                migratedData = {
                  ...saved,
                  membershipCard: { ...saved.membershipCard, code: card.code },
                };
              }
            } catch {
              /* Recover an empty Home, preserve onboarding separately. */
            }
          } else {
            const legacy = await storage.getItem(FOCUS_KEY);
            if (legacy) {
              try {
                const focus = JSON.parse(legacy);
                const monday = new Date();
                monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
                if (
                  focus.version === 1 &&
                  focus.week ===
                    `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`
                ) {
                  data.member.focusNote = note(focus.note);
                  data.member.focusDone = Boolean(data.member.focusNote);
                }
              } catch {
                /* Invalid legacy focus is ignored. */
              }
            }
          }
          // Persist issuance or conversion before displaying the card; failed writes can retry.
          if (migratedData) await write(migratedData);
          else if (!hasSavedCard) await write(data);
          set({ data, status: 'ready', now: Date.now() });
        } catch {
          set({
            status: 'failed',
            error: 'Your Home data could not be loaded or saved. Please try again.',
          });
        }
      },
      async saveNote(kind, value) {
        if (!value.trim() || value.trim().length > 400) {
          set({ error: 'Add a short note of 400 characters or fewer before saving.' });
          return false;
        }
        return commit(
          (d) => {
            if (kind === 'focus') {
              d.member.focusNote = value.trim();
              d.member.focusDone = true;
            } else {
              d.member.reflectionNote = value.trim();
              d.member.reflectionDone = true;
            }
          },
          kind === 'focus' ? 'Weekly focus saved.' : 'Weekly reflection saved.',
        );
      },
      async saveGoal(goal) {
        if (
          !goal.name.trim() ||
          goal.name.length > 120 ||
          !goal.success.trim() ||
          goal.success.length > 1000 ||
          !['4', '8', '12', '26', '52'].includes(goal.weeks)
        ) {
          set({ error: 'Add a goal, a success outcome and a listed timeframe.' });
          return false;
        }
        return commit((d) => {
          d.goal = { ...goal, name: goal.name.trim(), success: goal.success.trim() };
          d.goalSource = 'custom';
        }, 'Your plan has been updated.');
      },
      preset(membership, progress) {
        return commit((d) => {
          if (progress === 'new' || progress === 'returning') {
            const identity = { firstName: d.member.firstName, initials: d.member.initials };
            d.member = { ...createMember(progress === 'new', membership), ...identity };
          } else d.member.membership = membership;
          if (progress === 'complete') {
            const ids = lessons.filter((l) => canWatch(d.member, l)).map((l) => l.id);
            d.member.completed = ids;
            d.member.weeklyCompleted = ids;
            d.member.focusDone = true;
            d.member.reflectionDone = true;
            d.member.focusNote = 'Focus set';
            d.member.reflectionNote = 'Reflection complete';
          }
        }, 'Demo membership updated.');
      },
      async complete(id) {
        const lesson = lessons.find((l) => l.id === id);
        if (!lesson || !canWatch(get().data.member, lesson)) return false;
        return commit((d) => {
          if (!d.member.completed.includes(id)) d.member.completed.push(id);
          if (!d.member.weeklyCompleted.includes(id)) d.member.weeklyCompleted.push(id);
        }, 'Lesson complete. Home and Library progress updated.');
      },
      watch(id, position, elapsed) {
        const lesson = lessons.find((l) => l.id === id);
        const state = get();
        if (
          !lesson ||
          !canWatch(state.data.member, lesson) ||
          state.status !== 'ready' ||
          state.saving
        )
          return;
        set({
          data: {
            ...state.data,
            member: {
              ...state.data.member,
              positions: {
                ...state.data.member.positions,
                [id]: Math.max(0, Math.min(lesson.minutes * 60, position)),
              },
              weeklyMinutes: state.data.member.weeklyMinutes + Math.max(0, elapsed) / 60,
            },
          },
        });
      },
      async savePlayback() {
        // A completion/note commit holds a newer snapshot until its write resolves.
        // Do not queue the older visible state behind it when a player blurs.
        if (get().status !== 'ready' || get().saving) return;
        try {
          await write(get().data);
          if (get().error.startsWith('Learning progress could not be saved.'))
            set({ error: '', notice: 'Learning progress saved.' });
        } catch {
          set({
            error: 'Learning progress could not be saved. It is kept for this visit. Please retry.',
          });
        }
      },
      register(id, cancel = false) {
        const state = get();
        const event = eventCatalogue(state.data.eventAnchor).find((e) => e.id === id);
        if (
          !event ||
          !canAttend(state.data.member, event) ||
          (!cancel && eventStatus(event, state.data.registrations, Date.now()) !== 'Open')
        )
          return Promise.resolve(false);
        return commit(
          (d) => {
            d.registrations[id] = cancel ? 'cancelled' : 'registered';
          },
          cancel
            ? 'Demo registration cancelled.'
            : 'Demo place reserved on this device. No real booking was made.',
        );
      },
    };
  });
}
export const useMember = createMemberStore(AsyncStorage);
