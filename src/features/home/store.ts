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

export const MEMBER_KEY = 'master-app.native.member.v1';
type Data = {
  version: 1;
  member: Member;
  goal: Goal;
  eventAnchor: string;
  registrations: Registrations;
};
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
const freshData = (): Data => ({
  version: 1,
  member: createMember(),
  goal: { ...consultationGoal },
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
  const m = data.member;
  clean.member = createMember(
    true,
    Object.hasOwn(memberships, m.membership) ? m.membership : 'growth',
  );
  clean.member.firstName = note(m.firstName, 60) || 'Shan';
  clean.member.initials = note(m.initials, 4) || 'SY';
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
    };
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
      async hydrate() {
        if (get().status === 'loading' || get().status === 'ready') return;
        set({ status: 'loading', error: '' });
        try {
          const raw = await storage.getItem(MEMBER_KEY);
          let data = freshData();
          if (raw) {
            try {
              data = restore(JSON.parse(raw));
            } catch {
              /* Recover demo defaults, preserve onboarding separately. */
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
          set({ data, status: 'ready', now: Date.now() });
        } catch {
          set({
            status: 'failed',
            error: 'Your Home progress could not be loaded. Please try again.',
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
        }, 'Your plan has been updated.');
      },
      preset(membership, progress) {
        return commit((d) => {
          if (progress === 'new' || progress === 'returning')
            d.member = createMember(progress === 'new', membership);
          else d.member.membership = membership;
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
